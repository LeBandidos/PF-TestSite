// Uploads a list of files (relative to repo root) to the live host over SFTP.
// Used by deploy.sh, which works out *which* files changed; this script only
// does the upload. Reads credentials from process.env (populated by deploy.sh
// from .env). Not meant to be run standalone.
import Client from 'ssh2-sftp-client'
import { dirname } from 'node:path'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('Usage: node deploy.mjs <file1> [file2] ...')
  process.exit(1)
}

const remoteRoot = process.env.SFTP_REMOTE_ROOT.replace(/\/$/, '')

const sftp = new Client()
await sftp.connect({
  host: process.env.SFTP_HOST,
  port: Number(process.env.SFTP_PORT),
  username: process.env.SFTP_USER,
  password: process.env.SFTP_PASSWORD,
})

const failed = []
try {
  for (const f of files) {
    const remotePath = `${remoteRoot}/${f}`
    process.stdout.write(`uploading ${f} ... `)
    try {
      await sftp.mkdir(dirname(remotePath), true)
      await sftp.put(f, remotePath)
      console.log('done')
    } catch (err) {
      console.log('FAILED:', err.message)
      failed.push(f)
    }
  }
} finally {
  await sftp.end()
}

if (failed.length > 0) {
  console.log('\nCompleted with failures:')
  for (const f of failed) console.log(' ', f)
  process.exit(1)
}
console.log('\nAll files deployed successfully.')
