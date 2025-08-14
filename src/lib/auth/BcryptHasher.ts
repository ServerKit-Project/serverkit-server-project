import bcrypt from "bcryptjs";
import { PasswordHasher } from "./PasswordHasher";

/**
 * Default bcrypt password hasher
 */
export class BcryptHasher implements PasswordHasher {
    private saltRounds: number;

    constructor(saltRounds: number = 12) {
        this.saltRounds = saltRounds;
    }

    async hash(password: string): Promise<string> {
        const salt = await bcrypt.genSalt(this.saltRounds);
        return await bcrypt.hash(password, salt);
    }

    async verify(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    }
}
