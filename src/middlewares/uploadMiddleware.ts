import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// 환경변수에서 설정값 읽기
const uploadDirName = process.env.UPLOAD_DIR || "uploads";
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || "10485760"); // 기본값: 10MB (10 * 1024 * 1024)

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, "..", uploadDirName);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + crypto.randomBytes(6).toString("hex");
        const ext = path.extname(file.originalname);
        const safeFilename = uniqueSuffix + ext;

        cb(null, safeFilename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: maxFileSize
    },
    fileFilter: (req, file, cb) => {
        // 파일 타입 검증
        cb(null, true);
    }
});

export default upload;
