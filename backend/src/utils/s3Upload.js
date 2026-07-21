const {
    PutObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const { v4: uuid } = require("uuid");
const path = require("path");
const s3 = require("../config/s3");

const uploadFile = async (file, folder = "") => {
    const extension = path.extname(file.originalname);
    const key = `${folder}/${uuid()}${extension}`;
    await s3.send(
        new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype
        })
    );
    return { key };
};

const deleteFile = async (key) => {
    if (!key) return;
    await s3.send(
        new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        })
    );
};

module.exports = {
    uploadFile,
    deleteFile
};
