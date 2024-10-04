const cryptojs = require('crypto')

function encrypt(plainText: string) {
    const encryptionKey = 'MAKV2SPBNI99212';
    const salt = Buffer.from([0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d, 0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76]);

    // Create the key and IV using the same salt and encryption key
    const pdb = cryptojs.pbkdf2Sync(encryptionKey, salt, 1000, 48, 'sha1');
    const key = pdb.slice(0, 32);
    const iv = pdb.slice(32, 48);

    // Create the cipher
    const cipher = cryptojs.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf16le');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Return the encrypted text in base64 format
    return encrypted.toString('base64').replace(/\+/g, ' ');
}

const plainText = '123';
const cipherText = encrypt(plainText);
console.log('Encrypted:', cipherText);

module.exports = encrypt