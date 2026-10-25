import express from 'express';
import pg from 'pg';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'200kb'}));
app.use(express.urlencoded({extended:false}));
app.use(express.static(path.join(root, 'public'), {index:false}));
const pool = process.env.DATABASE_URL ? new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL === 'false' ? false : {rejectUnauthorized:false}}) : null;
const key = process.env.SESSION_SECRET;
const pass = process.env.ADMIN_PASSWORD;
if(!pool || !key || !pass) console.warn('Required environment vars: DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD. Live dashboard is disabled until configured.');
const ensure = (res) => {if(!pool || !key || !pass){res.status(503).json({error:'Server is not configured. Set DATABASE_URL, SESSION_SECRET, and ADMIN_PASSWORD.'});return false;}return true;};
const hmac = value => crypto.createHmac('sha256',key).update(value).digest('hex');
const cookie = req => Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
function authorized(req){if(!key)return false;const token=cookie(req).flynn_admin;if(!token)return false;const [expiry,sig]=token.split('.');if(!expiry||!sig||!/^\d+$/.test(expiry)||Date.now()>Number(expiry))return false;const expected=hmac(expiry);return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}
function admin(req,res,next){if(!authorized(req))return res.status(401).json({error:'Staff login required'});next();}
const throttle = new Map();
app.post('/api/login',(req,res)=>{if(!ensure(res))return;const ip=req.ip||'unknown', entry=throttle.get(ip)||{count:0,until:0};if(Date.now()<entry.until)return res.status(429).json({error:'Too many attempts. Try later.'});const given=Buffer.from(String(req.body.password||''));const expected=Buffer.from(pass);const valid=given.length===expected.length&&crypto.timingSafeEqual(given,expected);if(!valid){entry.count++;entry.until=entry.count>=5?Date.now()+15*60*1000:0;if(entry.count>=5)entry.count=0;throttle.set(ip,entry);return res.status(401).json({error:'Incorrect password'});}throttle.delete(ip);const expiry=String(Date.now()+8*60*60*1000);res.setHeader('Set-Cookie',`flynn_admin=${expiry}.${hmac(expiry)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);res.json({ok:true});});
app.post('/api/logout',(_req,res)=>{res.setHeader('Set-Cookie','flynn_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true});});
app.get('/api/session',(req,res)=>res.json({authenticated:authorized(req)}));
app.use('/api/admin',admin);
const eventFields=['title','description','location','tag','start_date','end_date','display_date','recurring','image_url','featured','active'];
const dealFields=['brand','description','location','category','badge','start_date','end_date','image_url','active','sort_order'];
const config={events:eventFields,deals:dealFields};
const publicWhere=(type)=>`active=true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW())`;
for(const type of Object.keys(config)){
  app.get(`/api/${type}`,async(req,res)=>{if(!ensure(res))return;try{let q=type==='events'?'ORDER BY featured DESC, start_date ASC NULLS LAST, id DESC':'ORDER BY sort_order ASC, id ASC';const rows=await pool.query(`SELECT * FROM ${type} WHERE ${publicWhere(type)} ${q}`);res.json(rows.rows);}catch{res.status(500).json({error:'Unable to load records'});}});
  app.get(`/api/admin/${type}`,async(req,res)=>{if(!ensure(res))return;try{const r=await pool.query(`SELECT * FROM ${type} ORDER BY id DESC`);res.json(r.rows);}catch{res.status(500).json({error:'Unable to load records'});}});
  app.post(`/api/admin/${type}`,async(req,res)=>{if(!ensure(res))return;try{const fields=config[type],values=fields.map(f=>normalize(f,req.body[f]));if(type==='events'&&!String(req.body.title||'').trim()||type==='deals'&&(!String(req.body.brand||'').trim()||!String(req.body.description||'').trim()))return res.status(400).json({error:'Required fields are missing'});const result=await pool.query(`INSERT INTO ${type} (${fields.join(',')}) VALUES (${fields.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,values);res.status(201).json(result.rows[0]);}catch(e){console.error(e);res.status(400).json({error:'Unable to save record. Check dates and fields.'});}});
  app.put(`/api/admin/${type}/:id`,async(req,res)=>{if(!ensure(res))return;try{const fields=config[type], values=fields.map(f=>normalize(f,req.body[f]));const r=await pool.query(`UPDATE ${type} SET ${fields.map((f,i)=>`${f}=$${i+1}`).join(',')},updated_at=NOW() WHERE id=$${fields.length+1} RETURNING *`,[...values,req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Not found'});res.json(r.rows[0]);}catch{res.status(400).json({error:'Unable to update record'});}});
  app.delete(`/api/admin/${type}/:id`,async(req,res)=>{if(!ensure(res))return;try{await pool.query(`DELETE FROM ${type} WHERE id=$1`,[req.params.id]);res.json({ok:true});}catch{res.status(500).json({error:'Unable to delete'});}});
}
function normalize(k,v){if(k==='active'||k==='featured')return v===true||v==='true';if(k==='sort_order')return Number(v)||0;if(k==='start_date'||k==='end_date')return v||null;return String(v??'').slice(0,k==='description'?2000:1000)||null;}
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},fileFilter:(_req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
app.post('/api/admin/upload',upload.single('image'),async(req,res)=>{if(!ensure(res))return;const {CLOUDINARY_CLOUD_NAME:cloud,CLOUDINARY_API_KEY:apiKey,CLOUDINARY_API_SECRET:secret}=process.env;if(!cloud||!apiKey||!secret)return res.status(503).json({error:'Image uploads require Cloudinary credentials; you can use an image URL meanwhile.'});if(!req.file)return res.status(400).json({error:'Select a JPG, PNG, or WebP under 5 MB'});try{const timestamp=Math.floor(Date.now()/1000);const signature=crypto.createHash('sha1').update(`folder=flynnstoned&timestamp=${timestamp}${secret}`).digest('hex');const fd=new FormData();fd.append('file',new Blob([req.file.buffer],{type:req.file.mimetype}),'upload');fd.append('api_key',apiKey);fd.append('timestamp',String(timestamp));fd.append('folder','flynnstoned');fd.append('signature',signature);const r=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`,{method:'POST',body:fd});const data=await r.json();if(!r.ok||!data.secure_url)throw Error('Image service rejected upload');res.json({url:data.secure_url});}catch{res.status(502).json({error:'Image upload failed'});}});
app.get(['/','/admin','/admin/','/calendar','/calendar/'],(req,res)=>res.sendFile(path.join(root,'public','index.html')));
app.get('/health',(_req,res)=>res.json({status:'ok',database:!!pool}));
const PORT=Number(process.env.PORT||3000);
async function initialize(){if(!pool)return;const schema=fs.readFileSync(path.join(root,'schema.sql'),'utf8');await pool.query(schema);const count=await pool.query('SELECT COUNT(*)::int AS count FROM deals');if(count.rows[0].count===0){const seed=JSON.parse(fs.readFileSync(path.join(root,'seed','home.json'),'utf8'));for(const [i,d] of seed.deals.items.entries())await pool.query('INSERT INTO deals (brand,description,location,category,sort_order) VALUES ($1,$2,$3,$4,$5)',[d.dispensary,d.deal,d.location,d.category,i]);}}
initialize().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`Flynnstoned listening on ${PORT}`))).catch(e=>{console.error('Database setup failed:',e.message);process.exit(1)});
