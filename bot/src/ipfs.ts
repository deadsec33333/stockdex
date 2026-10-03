// Pins the coin image to IPFS through Pinata.
// Pons stores the logo URI and description on chain, so there is no metadata JSON to upload.
import { config } from './config.js';

async function pin(file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', file, filename);
  form.append('network', 'public');
  const res = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.pinataJwt()}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata ${res.status}: ${await res.text()}`);
  const body: any = await res.json();
  return body.data.cid as string;
}

export async function uploadCoinImage(opts: { ticker: string; imageSourceUrl: string }):
  Promise<{ imageUrl: string; logoUri: string }> {
  const img = await fetch(opts.imageSourceUrl);
  if (!img.ok) throw new Error(`could not download image ${opts.imageSourceUrl}`);
  const cid = await pin(await img.blob(), `${opts.ticker}.png`);
  // ipfs:// goes on chain (512 byte limit), the gateway URL is what the website shows
  return { imageUrl: `https://ipfs.io/ipfs/${cid}`, logoUri: `ipfs://${cid}` };
}
