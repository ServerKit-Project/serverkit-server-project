export namespace Serverkit {
    export interface FileInfo {
        id: string;
        size: number;
        filename: string;
        mimetype: string;
        filePath: string;
        originalname: string;
        createdAt: Date;
    }
}
