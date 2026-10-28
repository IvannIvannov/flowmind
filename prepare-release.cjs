
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const VERSION = "1.0.0";
const BACKUP_SUFFIX = ".before-v1.bak";

function filePath(relativePath) {
    return path.join(ROOT, relativePath);
}

function readFile(relativePath) {
    const absolutePath = filePath(relativePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(
            `Missing file: ${relativePath}`
        );
    }

    return fs.readFileSync(absolutePath, "utf8");
}

function updateJson(relativePath, modify) {
    const original = readFile(relativePath);
    const parsed = JSON.parse(original);

    modify(parsed);

    return {
        relativePath,
        original,
        updated:
            JSON.stringify(parsed, null, 2) + "\n",
    };
}

function updateTomlSection(
    content,
    sectionName,
    updater
) {
    const lines = content.split(/\r?\n/);
    const header = `[${sectionName}]`;

    const start = lines.findIndex(
        (line) => line.trim() === header
    );

    if (start === -1) {
        return null;
    }

    let end = lines.length;

    for (let i = start + 1; i < lines.length; i++) {
        if (/^\s*\[/.test(lines[i])) {
            end = i;
            break;
        }
    }

    const sectionLines = lines.slice(
        start + 1,
        end
    );

    const updatedLines = updater(sectionLines);

    if (updatedLines === null) {
        return null;
    }

    lines.splice(
        start + 1,
        end - start - 1,
        ...updatedLines
    );

    const newline = content.includes("\r\n")
        ? "\r\n"
        : "\n";

    return lines.join(newline);
}

function replaceVersionLine(
    lines,
    key
) {
    const expression = new RegExp(
        `^(\\s*${key.replace(
            ".",
            "\\."
        )}\\s*=\\s*)["'][^"']+["'](.*)$`
    );

    const index = lines.findIndex(
        (line) => expression.test(line)
    );

    if (index === -1) {
        return null;
    }

    const updated = [...lines];

    updated[index] = updated[index].replace(
        expression,
        (_, prefix, suffix) =>
            `${prefix}"${VERSION}"${suffix}`
    );

    return updated;
}

function updateCargo() {
    const relativePath = "src-tauri/Cargo.toml";
    const original = readFile(relativePath);

    // Standard Cargo package version.
    const direct = updateTomlSection(
        original,
        "package",
        (lines) =>
            replaceVersionLine(lines, "version")
    );

    if (direct !== null) {
        return {
            relativePath,
            original,
            updated: direct,
        };
    }

    // Version inherited from the Cargo workspace.
    const packageUsesWorkspace =
        updateTomlSection(
            original,
            "package",
            (lines) => {
                const hasWorkspaceVersion =
                    lines.some((line) =>
                        /^\s*version\.workspace\s*=\s*true\b/.test(
                            line
                        )
                    );

                return hasWorkspaceVersion
                    ? lines
                    : null;
            }
        ) !== null;

    if (packageUsesWorkspace) {
        const inherited = updateTomlSection(
            original,
            "workspace.package",
            (lines) =>
                replaceVersionLine(lines, "version")
        );

        if (inherited !== null) {
            return {
                relativePath,
                original,
                updated: inherited,
            };
        }

        throw new Error(
            "Cargo.toml inherits its version from a " +
            "workspace outside this file. " +
            "No changes were made. " +
            "Please share Cargo.toml so we can " +
            "update the correct workspace file."
        );
    }

    throw new Error(
        "Could not locate a supported version " +
        "declaration in Cargo.toml. " +
        "No changes were made. " +
        "Please share the [package] section."
    );
}

function prepareChanges() {
    const changes = [];

    changes.push(
        updateJson("package.json", (pkg) => {
            pkg.version = VERSION;
        })
    );

    if (
        fs.existsSync(
            filePath("package-lock.json")
        )
    ) {
        changes.push(
            updateJson(
                "package-lock.json",
                (lock) => {
                    lock.version = VERSION;

                    if (
                        lock.packages &&
                        lock.packages[""]
                    ) {
                        lock.packages[""].version =
                            VERSION;
                    }
                }
            )
        );
    }

    changes.push(
        updateJson(
            "src-tauri/tauri.conf.json",
            (config) => {
                config.version = VERSION;
            }
        )
    );

    changes.push(updateCargo());

    return changes;
}

function main() {
    console.log(
        `Preparing FlowMind v${VERSION}...`
    );

    // Validate all files before writing.
    const changes = prepareChanges();

    for (const change of changes) {
        const backupPath =
            filePath(change.relativePath) +
            BACKUP_SUFFIX;

        if (fs.existsSync(backupPath)) {
            throw new Error(
                `Backup already exists: ${backupPath}`
            );
        }
    }

    const createdBackups = [];
    const modifiedFiles = [];

    try {
        // Backup every original file first.
        for (const change of changes) {
            const backupPath =
                filePath(change.relativePath) +
                BACKUP_SUFFIX;

            fs.writeFileSync(
                backupPath,
                change.original,
                "utf8"
            );

            createdBackups.push(backupPath);
        }

        // Apply only the intended updates.
        for (const change of changes) {
            fs.writeFileSync(
                filePath(change.relativePath),
                change.updated,
                "utf8"
            );

            modifiedFiles.push(change);
            console.log(
                `Updated: ${change.relativePath}`
            );
        }
    } catch (error) {
        // Restore files changed during this run.
        for (const change of modifiedFiles) {
            fs.writeFileSync(
                filePath(change.relativePath),
                change.original,
                "utf8"
            );
        }

        for (const backupPath of createdBackups) {
            if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
            }
        }

        throw error;
    }

    console.log("");
    console.log(
        `FlowMind version updated to ${VERSION}.`
    );

    console.log(
        "Original configuration backups were saved."
    );

    console.log(
        "Application identifier was not changed."
    );
}

try {
    main();
} catch (error) {
    console.error(
        "Release preparation failed:",
        error instanceof Error
            ? error.message
            : String(error)
    );

    process.exitCode = 1;
}
