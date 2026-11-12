import bcrypt from 'bcryptjs';
import { config } from '../config';

/**
 * Membuat hash bcrypt untuk kolom `users.password_hash`.
 *
 * Contoh:
 *   npm run hash-password -- "99999psfdv"
 */
const password = process.argv[2] ?? process.env.HASH_PASSWORD;

if (!password) {
  console.error('Penggunaan: npm run hash-password -- "password-anda"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, config.bcryptRounds);
console.log(hash);
