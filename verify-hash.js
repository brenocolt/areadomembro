const bcrypt = require('bcryptjs');

const hashFromDb = '$2b$10$t0w3QxwKnz0taIRg3dtUK.eMcRWCjZbyFVIFWUXkm4T9oy5awYCNS';
const passwordToTest = 'admin';

console.log('--- Password Verification ---');
console.log(`Database Hash: ${hashFromDb}`);
console.log(`Password Input: ${passwordToTest}`);

bcrypt.compare(passwordToTest, hashFromDb).then((match) => {
    console.log(`\nMatch Result: ${match ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (match) {
        console.log('Conclusion: The password "admin" is CORRECT for the current database record.');
    } else {
        console.log('Conclusion: The password does not match.');
    }
});
