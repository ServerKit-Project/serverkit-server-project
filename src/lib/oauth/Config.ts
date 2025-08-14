import path from "path";
import fs from "fs-extra";

const configFilePath = path.join(process.cwd(), "oauth-config.json");

export const oauthConfig = fs.readJsonSync(configFilePath);
