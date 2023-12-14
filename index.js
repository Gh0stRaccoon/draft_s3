import { GetObjectCommand, ListObjectVersionsCommand, ListObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import express from 'express';
import multer from 'multer';
import cors from 'cors';

const app = express();

const upload = multer();

app.use(express.json());
app.use(cors({ origin: '*' }));
app.use(express.urlencoded({ extended: true }));

const s3 = new S3Client({
    region: "us-east-1",
    credentials: {
        accessKeyId: "",
        secretAccessKey: ""
    }
})

const bucketName = "prueba-versiones"

// empresa/programas => documentos de todos los programas
app.get('/documents', async (req, res) => {
    const listObjects = await s3.send(new ListObjectsCommand({ Bucket: bucketName }))
    res.json(listObjects.Contents);
})

// empresa/programas/programa1 => se sube el documento
app.post('/documents', upload.single('file'), async (req, res) => {
    const { ...metadata } = req.body;
    const { originalname: name, buffer: file } = req.file;
    const upload = await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: name,
        Body: file,
        Metadata: metadata
    }))
    const logFile = await fs.readFile(`./logs/${name}.log`, { encoding: "utf-8" })
    const jsonLogFile = JSON.parse(logFile);
    const log = [...jsonLogFile, { date: new Date(), key: name, version: upload.VersionId, changes: metadata }]
    fs.writeFile(`./logs/${name}.log`, JSON.stringify(log), { encoding: "utf-8" });
    res.json({ upload, log });
})

app.get('/versions/:name', async (req, res) => {
    const { name } = req.params;
    const listObjects = await s3.send(new ListObjectVersionsCommand({ Bucket: bucketName, Prefix: name }))
    const log = await fs.readFile(`./logs/${name}.log`, { encoding: "utf-8" });
    const jsonLog = JSON.parse(log);
    res.json({ versions: listObjects.Versions, chagesLogs: jsonLog });
})

app.get('/documents/:name', async (req, res) => {
    const { name } = req.params;
    const response = await s3.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: name
    }))
    res.set('Content-Type', response.ContentType);
    res.set('Content-Disposition', `attachment; filename=${name}`);
    // metadata de todas las versiones
    response.Body.pipe(res);
})

app.get('/documents/:name/:version', async (req, res) => {
    const { name, version } = req.params;
    const response = await s3.send(
        new GetObjectCommand({
            Bucket: bucketName,
            Key: name,
            VersionId: version
        })
    );
    res.set('Content-Type', response.ContentType);
    res.set('Content-Disposition', `attachment; filename=${name}`);
    response.Body.pipe(res);
})


app.listen(8080, () => {
    console.log('Server is listening on port 8080');
})