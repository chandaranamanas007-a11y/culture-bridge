// server/googleDriveClient.js
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service account credentials from env var or file
let credentials;
const rawCred = process.env.GOOGLE_SERVICE_ACCOUNT?.trim();
if (rawCred) {
  try {
    if (rawCred.startsWith('{')) {
      credentials = JSON.parse(rawCred);
    } else {
      const credPath = path.isAbsolute(rawCred) ? rawCred : path.join(__dirname, rawCred);
      credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT env var:', e);
    credentials = null;
  }
}

let drive;
if (credentials && process.env.GOOGLE_DRIVE_FOLDER_ID) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  drive = google.drive({ version: 'v3', auth });
} else {
  console.warn('Google Drive integration disabled – missing SERVICE_ACCOUNT or FOLDER_ID');
}

/** Find the file ID for a given name inside the designated folder */
async function findFileId(fileName) {
  if (!drive) return null;
  try {
    const res = await drive.files.list({
      q: `name='${fileName}' and '${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id)',
    });
    const file = res.data.files?.[0];
    return file ? file.id : null;
  } catch (err) {
    console.error('Error locating file on Drive:', err);
    return null;
  }
}

/** Read a JSON file from Google Drive */
export async function readJson(fileName) {
  if (!drive) return null;
  const fileId = await findFileId(fileName);
  if (!fileId) return null;
  try {
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    let data = '';
    await new Promise((resolve, reject) => {
      res.data
        .on('data', chunk => (data += chunk))
        .on('end', resolve)
        .on('error', reject);
    });
    return JSON.parse(data);
  } catch (err) {
    console.error(`Failed to read ${fileName} from Drive:`, err);
    return null;
  }
}

/** Write a JSON file to Google Drive (create or update) */
export async function writeJson(fileName, obj) {
  if (!drive) return;
  const content = JSON.stringify(obj, null, 2);
  const media = { mimeType: 'application/json', body: Buffer.from(content) };
  const fileId = await findFileId(fileName);
  try {
    if (fileId) {
      await drive.files.update({ fileId, media });
    } else {
      await drive.files.create({
        requestBody: { name: fileName, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] },
        media,
      });
    }
    console.log(`✅ Synced ${fileName} to Google Drive`);
  } catch (err) {
    console.error(`Failed to write ${fileName} to Drive:`, err);
  }
}

export default { readJson, writeJson };
