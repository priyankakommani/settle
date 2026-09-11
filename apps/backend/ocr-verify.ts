import { runOcr } from './src/ingestion/ocr.js';
import { readFile } from 'node:fs/promises';

const buf = await readFile('seed-data/pack/receipts/hotel_invoice_1188.png');
const text = await runOcr(buf, 'image/png');
console.log('--- OCR RESULT ---');
console.log(text);
