export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const method = request.method;

        // CORS Headers
        const corsHeaders = {
            "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        // Handle Preflight
        if (method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // Simple Auth configuration
        const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "Boutique2026!"; // Fallback password if secret not set

        // Helper to check authentication
        const isAuthenticated = () => {
            const authHeader = request.headers.get("Authorization");
            if (!authHeader) return false;
            // Support both "Bearer <password>" and just "<password>"
            const token = authHeader.replace("Bearer ", "").trim();
            return token === ADMIN_PASSWORD;
        };

        try {
            // ✅ AUTO-INITIALIZE DATABASE TABLES ON FIRST RUN
            // No manual SQL commands needed — tables are created automatically!
            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS products (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    price REAL DEFAULT 0,
                    was REAL DEFAULT 0,
                    status TEXT DEFAULT 'today',
                    imageUrl TEXT,
                    videoUrl TEXT,
                    hidden INTEGER DEFAULT 0,
                    sizes TEXT,
                    colors TEXT,
                    note TEXT,
                    gender TEXT DEFAULT 'f',
                    cat TEXT DEFAULT 'clothes',
                    ends TEXT,
                    section TEXT DEFAULT 'article',
                    position INTEGER DEFAULT 0,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `).run();

            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            `).run();

            // 1. GET CATALOG
            if (url.pathname === "/api/catalog" && method === "GET") {
                const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY position ASC, createdAt DESC").all();
                const catalog = results.map(row => ({
                    ...row,
                    sizes: row.sizes ? JSON.parse(row.sizes) : [],
                    colors: row.colors ? JSON.parse(row.colors) : []
                }));
                return new Response(JSON.stringify({ ok: true, catalog }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 2b. BULK SAVE CATALOG
            if (url.pathname === "/api/bulk-save" && method === "POST") {
                if (!isAuthenticated()) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const { catalog } = await request.json();
                if (!Array.isArray(catalog)) return new Response("Invalid data", { status: 400, headers: corsHeaders });

                const statements = catalog.map(item => {
                    const { id, title, price, was, status, imageUrl, videoUrl, hidden, sizes, colors, note, gender, cat, ends, section, position } = item;
                    return env.DB.prepare('INSERT INTO products (id, title, price, was, status, imageUrl, videoUrl, hidden, sizes, colors, note, gender, cat, ends, section, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, price=excluded.price, was=excluded.was, status=excluded.status, imageUrl=excluded.imageUrl, videoUrl=excluded.videoUrl, hidden=excluded.hidden, sizes=excluded.sizes, colors=excluded.colors, note=excluded.note, gender=excluded.gender, cat=excluded.cat, ends=excluded.ends, section=excluded.section, position=excluded.position').bind(id, title, price, was, status, imageUrl || null, videoUrl || null, hidden ? 1 : 0, JSON.stringify(sizes || []), JSON.stringify(colors || []), note || null, gender || 'f', cat || 'clothes', ends || null, section || 'article', position || 0);
                });

                await env.DB.batch(statements);
                return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 2. SAVE/UPDATE PRODUCT
            if (url.pathname === "/api/save" && method === "POST") {
                if (!isAuthenticated()) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const body = await request.json();
                const { id, title, price, was, status, imageUrl, videoUrl, hidden, sizes, colors, note, gender, cat, ends, section, position } = body;

                const existing = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();

                if (existing) {
                    await env.DB.prepare(`
                        UPDATE products SET 
                          title = ?, price = ?, was = ?, status = ?, imageUrl = ?, videoUrl = ?, 
                          hidden = ?, sizes = ?, colors = ?, note = ?, gender = ?, cat = ?, 
                          ends = ?, section = ?, position = ?
                        WHERE id = ?
                    `).bind(
                        title, price, was, status, imageUrl || null, videoUrl || null,
                        hidden ? 1 : 0, JSON.stringify(sizes || []), JSON.stringify(colors || []),
                        note || null, gender || 'f', cat || 'clothes', ends || null, section || 'article',
                        position || 0, id
                    ).run();
                } else {
                    await env.DB.prepare(`
                        INSERT INTO products (
                          id, title, price, was, status, imageUrl, videoUrl, hidden, 
                          sizes, colors, note, gender, cat, ends, section, position
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        id, title, price, was, status, imageUrl || null, videoUrl || null,
                        hidden ? 1 : 0, JSON.stringify(sizes || []), JSON.stringify(colors || []),
                        note || null, gender || 'f', cat || 'clothes', ends || null, section || 'article',
                        position || 0
                    ).run();
                }

                return new Response(JSON.stringify({ ok: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 3. DELETE PRODUCT
            if (url.pathname.startsWith("/api/delete/") && method === "DELETE") {
                if (!isAuthenticated()) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const id = url.pathname.split("/").pop();
                await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
                return new Response(JSON.stringify({ ok: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 4. UPLOAD MEDIA TO R2
            if (url.pathname === "/api/upload" && method === "POST") {
                if (!isAuthenticated()) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const formData = await request.formData();
                const file = formData.get("file");
                const folder = formData.get("folder") || "general";

                if (!file) {
                    return new Response(JSON.stringify({ ok: false, error: "No file uploaded" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }

                const ext = file.name.split('.').pop();
                const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
                await env.BUCKET.put(filename, file.stream(), {
                    httpMetadata: { contentType: file.type }
                });

                // R2 public URL — set your R2 custom domain in Cloudflare Dashboard
                const r2Domain = env.R2_PUBLIC_DOMAIN || "";
                const publicUrl = r2Domain ? `${r2Domain}/${filename}` : filename;

                return new Response(JSON.stringify({ ok: true, url: publicUrl, key: filename }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 5. GET SOCIAL LINKS
            if (url.pathname === "/api/social" && method === "GET") {
                const { results } = await env.DB.prepare("SELECT * FROM settings WHERE key LIKE 'social_%'").all();
                const social = results.reduce((acc, row) => ({ ...acc, [row.key.replace('social_', '')]: row.value }), {});
                return new Response(JSON.stringify({ ok: true, social }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 6. SAVE SOCIAL LINK
            if (url.pathname === "/api/social" && method === "POST") {
                if (!isAuthenticated()) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
                const { type, value } = await request.json();
                await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?")
                    .bind(`social_${type}`, value, value).run();
                return new Response(JSON.stringify({ ok: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 7. VISITOR STATS — GET
            if (url.pathname === "/api/stats" && method === "GET") {
                const result = await env.DB.prepare("SELECT value FROM settings WHERE key = 'total_visitors'").first();
                const total = result ? parseInt(result.value) : 0;
                return new Response(JSON.stringify({ ok: true, total }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 8. VISITOR STATS — INCREMENT
            if (url.pathname === "/api/stats/increment" && method === "POST") {
                await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('total_visitors', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)").run();
                return new Response(JSON.stringify({ ok: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 9. VERIFY AUTH TOKEN
            if (url.pathname === "/api/auth" && method === "POST") {
                if (!isAuthenticated()) {
                    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
                        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }
                return new Response(JSON.stringify({ ok: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            return new Response("Not Found", { status: 404, headers: corsHeaders });

        } catch (err) {
            return new Response(JSON.stringify({ ok: false, error: err.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    }
};
