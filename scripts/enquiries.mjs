#!/usr/bin/env node
// List enquiries from the terminal:  ENQUIRY_KEY=… node scripts/enquiries.mjs [status]
const key = process.env.ENQUIRY_KEY;
if (!key) { console.error('Set ENQUIRY_KEY (the secret given to `wrangler secret put ENQUIRY_KEY`).'); process.exit(1); }
const status = process.argv[2] ? `?status=${process.argv[2]}` : '';
const r = await fetch(`https://donkeytalk.sankhacooray.com/api/enquiries${status}`, { headers: { Authorization: `Bearer ${key}` } });
const { enquiries, error } = await r.json();
if (error) { console.error(error); process.exit(1); }
for (const e of enquiries) console.log(`#${e.id}  ${e.at.slice(0, 16).replace('T', ' ')}  [${e.status}]  ${e.name} <${e.email}>  ${e.org || ''}  ${e.printer || ''}  ${e.platform || ''}\n    ${(e.message || '').replace(/\n/g, '\n    ')}`);
if (!enquiries.length) console.log('No enquiries.');
