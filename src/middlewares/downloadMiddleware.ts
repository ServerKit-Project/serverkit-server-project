import fs from "fs";
import path from "path";
import { RequestHandler } from "express";
import { Serverkit } from "../types/serverkit";

interface DownloadLocals {
    fileData?: Serverkit.FileInfo;
}

const $reservedDownloadHandler: RequestHandler<{}, any, any, any, DownloadLocals> = (req, res, next) => {
    try {
        const fileData = res.locals.fileData;

        if (!fileData) {
            res.status(500).json({
                error: "No file data provided for download"
            });
            return;
        }

        // 파일 경로 보안 검증 (Path Traversal 방지)
        const normalizedPath = path.normalize(fileData.filePath);
        if (normalizedPath.includes("..")) {
            res.status(403).json({
                error: "Invalid file path"
            });
            return;
        }

        // 파일 존재 여부 확인
        if (!fs.existsSync(fileData.filePath)) {
            res.status(404).json({
                error: "File not found"
            });
            return;
        }

        // 원본 파일명 가져오기 (fileData.originalname이 없으면 filename 사용)
        const filename = fileData.filename || fileData.originalname || path.basename(fileData.filePath);

        // res.download()를 사용하여 파일 전송
        // 세 번째 파라미터는 다운로드 완료 후 콜백
        res.download(fileData.filePath, filename, (err: Error | null) => {
            if (err) {
                console.error("Download error:", err);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: "Error downloading file"
                    });
                }
            }
        });
    } catch (error) {
        console.error("Download handler error:", error);
        if (!res.headersSent) {
            res.status(500).json({
                error: "Internal server error during file download"
            });
        }
    }
};

export default $reservedDownloadHandler;
