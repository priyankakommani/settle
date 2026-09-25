export interface OcrResult {
  status: 'done' | 'failed' | 'skipped';
  text: string;
}

/**
 * OCR a receipt image. Implementation (code phase): local Tesseract or a
 * vision API behind this interface. Whatever happens, ingestion must not
 * crash — a failure returns { status: 'failed', text: '' } and the UI falls
 * back to manual entry.
 */
export async function runOcr(_image: Buffer, _mime: string): Promise<OcrResult> {
  return { status: 'skipped', text: '' };
}
