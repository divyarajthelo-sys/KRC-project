const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const { updateDocx } = require("./documentGenerator");

const forms = [
    ["FORM 1", "Form 1.docx"],
    ["FORM 3", "FORM 3.docx"],
    ["FORM 5", "FORM 5.docx"],
    ["FORM 18", "FORM 18.docx"],
    ["FORM 28", "FORM 28.docx"]
];
const data = {
    college_id: 1,
    title: "Test title",
    applicant_name: "Test applicant",
    applicant_address: "Test address",
    date: "2026-09-22",
    inventors: [{ inventor_name: "Only inventor", inventor_address: "Only address" }]
};

for (const [formName, filename] of forms) {
    const output = path.join(__dirname, "temp", `${formName}-format-check.docx`);

    try {
        updateDocx(path.join(__dirname, "documents", filename), output, data, formName);
        const zip = new PizZip(fs.readFileSync(output));
        const content = Object.keys(zip.files)
            .filter((name) => /^word\/(document|header|footer|footnotes|endnotes|comments).*\.xml$/i.test(name))
            .map((name) => zip.file(name).asText())
            .join("");

        if (/<w:color\b[^>]*w:val=["'](?:FF0000|red)["']/i.test(content) || /<w:highlight\b/i.test(content)) {
            throw new Error(`${formName} still contains red field formatting`);
        }
    } finally {
        if (fs.existsSync(output)) fs.unlinkSync(output);
    }
}
