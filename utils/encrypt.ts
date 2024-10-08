const cryptojs = require('crypto');

function encrypt(clearText: string): string {
    const EncryptionKey = "MAKV2SPBNI99212";
    const salt = Buffer.from([0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d, 0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76]);

    // Create key and IV using PBKDF2
    const pdb = cryptojs.pbkdf2Sync(EncryptionKey, salt, 1000, 48, 'sha1');
    const key = pdb.slice(0, 32);
    const iv = pdb.slice(32, 48);

    // Create the cipher and encrypt
    const cipher = cryptojs.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(clearText, 'utf16le', 'base64');
    encrypted += cipher.final('base64');

    return encrypted;
}

// Example usage
const clearText = 'Jyotindra';
const cipherText = encrypt(clearText);
console.log('Encrypted:', cipherText);

module.exports = encrypt;

