require('dotenv').config({ path: '.env' });
const { S3Client, GetBucketLocationCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

async function check() {
    try {
        const res = await s3.send(new GetBucketLocationCommand({ Bucket: process.env.AWS_BUCKET_NAME }));
        console.log('✅ Bucket found!');
        console.log('   Bucket name:', process.env.AWS_BUCKET_NAME);
        console.log('   Bucket region:', res.LocationConstraint || 'us-east-1');
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error('   Bucket tried:', process.env.AWS_BUCKET_NAME);
        console.error('   Region used:', process.env.AWS_REGION);
    }
}

check();
