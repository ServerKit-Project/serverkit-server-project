// import fs from "fs-extra";
// import path from "path";
// import { TokenService, IKeys } from "./TokenService";

// class KeyManager {
//     private static instance: KeyManager;
//     private tokenService: TokenService | null = null;

//     private constructor() {}

//     static getInstance(): KeyManager {
//         if (!KeyManager.instance) {
//             KeyManager.instance = new KeyManager();
//         }
//         return KeyManager.instance;
//     }

//     async initialize(): Promise<void> {
//         if (this.tokenService) {
//             return; // 이미 초기화됨
//         }

//         const privateKey = await fs.readFile(path.join(process.cwd(), "keys", "private_key.pem"), "utf8");
//         const publicKey = await fs.readFile(path.join(process.cwd(), "keys", "public_key.pem"), "utf8");

//         this.tokenService = new TokenService({
//             privateKey,
//             publicKey
//         });
//     }

//     getTokenService(): TokenService {
//         if (!this.tokenService) {
//             throw new Error("KeyManager not initialized. Call initialize() first.");
//         }
//         return this.tokenService;
//     }
// }

// export const keyManager = KeyManager.getInstance();
