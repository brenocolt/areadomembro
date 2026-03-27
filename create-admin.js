const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@produtivajunior.com.br';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`Creating user with email: ${email} and password: ${password}`);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            senha: hashedPassword, // Update password if exists just in case
            role: 'ADMIN' // Ensure admin
        },
        create: {
            email,
            senha: hashedPassword,
            role: 'ADMIN',
        },
    });

    console.log('User created/updated:', user);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
