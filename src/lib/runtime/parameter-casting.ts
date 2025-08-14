/**
 * Cast a parameter value to the specified type
 * Used for type conversion in API route handlers, especially for query parameters
 *
 * @param value - The value to cast
 * @param type - The target type
 * @returns The casted value
 * @throws Error if the value cannot be cast to the target type
 */
export function castParameter(value: any, type: string): any {
    if (value === undefined || value === null) {
        return value;
    }

    switch (type) {
        case "number":
            const num = Number(value);
            if (isNaN(num)) {
                throw new Error(`Invalid number value: ${value}`);
            }
            return num;

        case "boolean":
            if (typeof value === "boolean") return value;
            if (value === "true") return true;
            if (value === "false") return false;
            throw new Error(`Invalid boolean value: ${value}`);

        case "string":
            return String(value);

        case "array":
            if (Array.isArray(value)) return value;
            // If it's a string, try to parse it as JSON
            if (typeof value === "string") {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    // Not valid JSON, return as single-element array
                    return [value];
                }
            }
            return [value];

        case "object":
            if (typeof value === "object") return value;
            // If it's a string, try to parse it as JSON
            if (typeof value === "string") {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    throw new Error(`Invalid JSON object: ${value}`);
                }
            }
            return value;

        default:
            // For unknown types, return as-is
            return value;
    }
}

// CommonJS export for runtime compatibility
module.exports = { castParameter };
