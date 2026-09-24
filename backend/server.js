require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const PizZip = require("pizzip");

const db = require("./db");

const {
    generateAll,
    COLLEGES,
    MAX_INVENTORS,
    prepareForm9,
    FORM_DISPLAY_NAMES
} = require("./documentGenerator");

const app = express();

/*
    Hosting platforms (Railway, Render, etc.)
    assign their own PORT via env var - 5000
    stays as the local-dev fallback.
*/
const PORT =
    Number(process.env.PORT) || 5000;

const GENERATED_DIR =
    path.join(
        __dirname,
        "generated"
    );

fs.mkdirSync(
    GENERATED_DIR,
    {
        recursive: true
    }
);

app.use(cors());

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    "/generated",
    express.static(
        GENERATED_DIR
    )
);

app.get(
    "/",
    (req, res) => {
        res.json({
            message:
                "KRC Document Portal Backend is running"
        });
    }
);

/*
   Get colleges
*/
app.get(
    "/api/colleges",
    (req, res) => {
        const colleges = Object.entries(COLLEGES).map(
            ([id, college]) => ({
                id: Number(id),
                college_name: college.name,
                college_address: college.address
            })
        );

        res.json(colleges);
    }
);

/*
   Create application
*/
app.post("/api/applications", (req, res) => {

    const {
        college_id,
        title,
        applicant_name,
        applicant_address,
        date,
        inventors
    } = req.body;

    /*
       Validate college
    */
    if (!college_id) {
        return res
            .status(400)
            .json({
                message:
                    "College is required"
            });
    }

    /*
       Validate title
    */
    if (!title || !String(title).trim()) {
        return res
            .status(400)
            .json({
                message:
                    "Title is required"
            });
    }

    /*
       Validate applicant name
    */
    if (
        !applicant_name ||
        !String(applicant_name).trim()
    ) {
        return res
            .status(400)
            .json({
                message:
                    "Applicant name is required"
            });
    }

    /*
       Validate applicant address
    */
    if (
        !applicant_address ||
        !String(applicant_address).trim()
    ) {
        return res
            .status(400)
            .json({
                message:
                    "Applicant address is required"
            });
    }

    /*
       Check college
    */
    const college =
        COLLEGES[
            Number(college_id)
        ];

    if (!college) {
        return res
            .status(400)
            .json({
                message:
                    "Invalid college"
            });
    }

    /*
       Inventors
       The templates contain eight inventor slots.
    */
    const cleanInventors =
        Array.isArray(inventors)
            ? inventors
                .filter(
                    (inventor) =>
                        inventor &&
                        String(
                            inventor.inventor_name || ""
                        ).trim() !== "" &&
                        String(
                            inventor.inventor_address || ""
                        ).trim() !== ""
                )
            : [];

    /*
       At least one inventor required
    */
    if (cleanInventors.length === 0) {
        return res
            .status(400)
            .json({
                message:
                    "At least one inventor is required"
            });
    }

    if (cleanInventors.length > MAX_INVENTORS) {
        return res
            .status(400)
            .json({
                message: `A maximum of ${MAX_INVENTORS} inventors is supported`
            });
    }

    /*
       Submission date
    */
    const submissionDate =
        date ||
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).format(new Date());

    /*
       Insert application
    */
    const insertApplicationSql = `
        INSERT INTO applications
        (
            college_id,
            title,
            applicant_name,
            applicant_address,
            date
        )
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        insertApplicationSql,
        [
            Number(college_id),
            String(title).trim(),
            String(
                applicant_name
            ).trim(),
            String(
                applicant_address
            ).trim(),
            submissionDate
        ],
        (err, result) => {

            if (err) {
                console.error(err);

                return res
                    .status(500)
                    .json({
                        message:
                            "Application save failed"
                    });
            }

            const applicationId =
                result.insertId;

            /*
               Save inventors
            */
            saveInventors(
                applicationId,
                cleanInventors,
                (inventorError) => {

                    if (inventorError) {
                        return res
                            .status(500)
                            .json({
                                message:
                                    "Inventor save failed",
                                applicationId
                            });
                    }

                    /*
                       Generate documents
                    */
                    try {

                        const files =
                            generateAll(
                                {
                                    college_id:
                                        Number(
                                            college_id
                                        ),

                                    title:
                                        String(
                                            title
                                        ).trim(),

                                    applicant_name:
                                        String(
                                            applicant_name
                                        ).trim(),

                                    applicant_address:
                                        String(
                                            applicant_address
                                        ).trim(),

                                    date:
                                        submissionDate,

                                    inventors:
                                        cleanInventors
                                },
                                applicationId
                            );

                        return res
                            .status(201)
                            .json({
                                message:
                                    "Application saved and documents generated",

                                applicationId,

                                files
                            });

                    } catch (generationError) {

                        console.error(
                            generationError
                        );

                        fs.readdirSync(
                            GENERATED_DIR
                        )
                            .filter(
                                (filename) =>
                                    filename.endsWith(
                                        `_${applicationId}.docx`
                                    )
                            )
                            .forEach(
                                (filename) =>
                                    fs.unlinkSync(
                                        path.join(
                                            GENERATED_DIR,
                                            filename
                                        )
                                    )
                            );

                        return res
                            .status(503)
                            .json({
                                message:
                                    "Application saved, but document generation failed",

                                applicationId,

                                error:
                                    generationError.message
                            });
                    }
                }
            );
        }
    );
});

/*
   Save inventors
*/
function saveInventors(
    applicationId,
    inventors,
    callback
) {

    if (
        !Array.isArray(inventors) ||
        inventors.length === 0
    ) {
        return callback();
    }

    const values =
        inventors.map(
            (inventor, index) => [
                applicationId,
                index + 1,

                String(
                    inventor.inventor_name ||
                    ""
                ).trim(),

                String(
                    inventor.inventor_address ||
                    ""
                ).trim()
            ]
        );

    db.query(
        `
        INSERT INTO inventors
        (
            application_id,
            inventor_number,
            inventor_name,
            inventor_address
        )
        VALUES ?
        `,
        [values],
        (err) => {

            if (err) {
                console.error(err);

                return callback(
                    err
                );
            }

            callback();
        }
    );
}

/*
   A generated file is stored on disk as
   "<FORM>_<applicationId>.docx" so different
   applications never collide in the shared
   generated/ folder, but it should be shown/
   downloaded under the same name as the
   original document (e.g. "FORM 18.docx").
*/
function getDisplayName(
    filename,
    id
) {
    const suffix =
        `_${id}.docx`;

    if (
        !filename.endsWith(
            suffix
        )
    ) {
        return filename;
    }

    const formName =
        filename
            .slice(
                0,
                filename.length -
                    suffix.length
            )
            .replace(
                /_/g,
                " "
            );

    return (
        FORM_DISPLAY_NAMES[
            formName
        ] || filename
    );
}

/*
   Get generated documents
*/
app.get(
    "/api/applications/:id/documents",
    (req, res) => {

        const id =
            Number(
                req.params.id
            );

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return res
                .status(400)
                .json({
                    message:
                        "Invalid application id"
                });
        }

        const files =
            fs
                .readdirSync(
                    GENERATED_DIR
                )
                .filter(
                    (filename) =>
                        filename.endsWith(
                            `_${id}.docx`
                        )
                )
                .map(
                    (filename) => ({
                        filename,

                        displayName:
                            getDisplayName(
                                filename,
                                id
                            ),

                        url:
                            `/generated/${encodeURIComponent(
                                filename
                            )}`
                    })
                );

        res.json({
            applicationId: id,
            files
        });
    }
);

/*
   Download all generated documents
   for one application as a single ZIP
*/
app.get(
    "/api/applications/:id/documents/zip",
    (req, res) => {

        const id =
            Number(
                req.params.id
            );

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return res
                .status(400)
                .json({
                    message:
                        "Invalid application id"
                });
        }

        const filenames =
            fs
                .readdirSync(
                    GENERATED_DIR
                )
                .filter(
                    (filename) =>
                        filename.endsWith(
                            `_${id}.docx`
                        )
                );

        if (filenames.length === 0) {
            return res
                .status(404)
                .json({
                    message:
                        "No documents found for this application"
                });
        }

        const zip = new PizZip();

        for (const filename of filenames) {
            /*
                Store each file in the zip under
                its original document name (e.g.
                "FORM 18.docx") rather than its
                on-disk "FORM_18_49.docx" name -
                safe here since one application's
                zip never has two files sharing
                the same form.
            */
            zip.file(
                getDisplayName(
                    filename,
                    id
                ),
                fs.readFileSync(
                    path.join(
                        GENERATED_DIR,
                        filename
                    )
                )
            );
        }

        const zipBuffer =
            zip.generate({
                type: "nodebuffer",
                compression: "DEFLATE"
            });

        res.set({
            "Content-Type":
                "application/zip",
            "Content-Disposition":
                `attachment; filename="Application_${id}_Documents.zip"`
        });

        res.send(zipBuffer);
    }
);

/*
   Get all applications
*/
app.get(
    "/api/applications",
    (req, res) => {

        const sql = `
            SELECT
                a.id,
                a.title,
                a.applicant_name,
                a.applicant_address,
                a.date,
                a.created_at,
                c.college_name,
                c.college_address
            FROM applications a
            INNER JOIN colleges c
                ON c.id = a.college_id
            ORDER BY a.id DESC
        `;

        db.query(
            sql,
            (err, rows) => {

                if (err) {
                    console.error(err);

                    return res
                        .status(500)
                        .json({
                            message:
                                "Failed to load applications"
                        });
                }

                res.json(rows);
            }
        );
    }
);

/*
   Start server
*/
app.listen(
    PORT,
    () => {
        console.log(
            `KRC Backend running on http://localhost:${PORT}`
        );

        /*
           Warm up the FORM 9 LibreOffice
           conversion cache at startup so the
           first user to click "Add" doesn't
           have to wait for it (LibreOffice
           conversion is slow the first time,
           then cached and reused after).
        */
        try {
            prepareForm9();

            console.log(
                "FORM 9 conversion cache is ready"
            );
        } catch (err) {
            console.error(
                "FORM 9 warm-up failed (FORM 9 will convert on first use instead):",
                err.message
            );
        }
    }
);
