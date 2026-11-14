/**
 * Security & Tenant Isolation Regression Test Suite
 * Stage 2 — Verification of VULN-01, VULN-02, VULN-03, RLS and Account Deletion
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          console.log(`  ✓ PASS: ${name}`);
          passed++;
        })
        .catch((err: Error) => {
          console.error(`  ✗ FAIL: ${name}`);
          console.error(`    ${err.message}`);
          failed++;
        });
    }
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   AUTO AUDIT STAGE 2 — SECURITY REGRESSION TESTS     ");
  console.log("=======================================================\n");

  // --------------------------------------------------------------------------
  // TEST GROUP 1: VULN-01 — Fail-Closed Authorization (mock-auth-provider.tsx)
  // --------------------------------------------------------------------------
  console.log("1. Verifying VULN-01 (mock-auth-provider.tsx fail-closed fix):");

  test("mock-auth-provider source must not contain mock admin fallback", () => {
    const providerPath = path.join(rootDir, "src", "providers", "mock-auth-provider.tsx");
    const content = fs.readFileSync(providerPath, "utf8");

    assert.ok(
      !content.includes('role: "admin" as AppRole'),
      "VULN-01 VIOLATION: Found 'role: \"admin\" as AppRole' in mock-auth-provider fallback!",
    );
    assert.ok(
      !content.includes('"manage_users", "manage_roles"'),
      "VULN-01 VIOLATION: Found administrative permissions granted in error fallback!",
    );
    assert.ok(
      content.includes('role: "viewer" as AppRole'),
      "mock-auth-provider must fallback to 'viewer' role on permission failure",
    );
    assert.ok(
      content.includes("permissions: [] as AppPermission[]"),
      "mock-auth-provider must assign empty permissions [] on error",
    );
    assert.ok(
      !content.includes("import { currentUser }"),
      "mock-auth-provider must not import or fall back to currentUser mock admin",
    );
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 2: VULN-02 — ERP Ingest Authentication (/api/public/erp/ingest)
  // --------------------------------------------------------------------------
  console.log("\n2. Verifying VULN-02 (Secure ERP Ingestion & Tenant Isolation):");

  test("/api/public/erp/ingest must not contain hardcoded tenant user ID", () => {
    const ingestPath = path.join(rootDir, "src", "routes", "api", "public", "erp", "ingest.ts");
    const content = fs.readFileSync(ingestPath, "utf8");

    const hardcodedId = "6da40485-c78c-458f-9f9d-7d76e9b3137d";
    assert.ok(
      !content.includes(hardcodedId),
      `VULN-02 VIOLATION: Found hardcoded tenant user ID ${hardcodedId} in ingest.ts!`,
    );
  });

  test("/api/public/erp/ingest must strictly require authentication credentials", () => {
    const ingestPath = path.join(rootDir, "src", "routes", "api", "public", "erp", "ingest.ts");
    const content = fs.readFileSync(ingestPath, "utf8");

    assert.ok(
      content.includes("status: 401"),
      "ingest.ts must return HTTP 401 Unauthorized when credentials are missing or invalid",
    );
    assert.ok(
      content.includes("authData?.user?.id"),
      "ingest.ts must derive targetUserId cryptographically from verified authData.user.id",
    );
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 3: VULN-03 — JWT Claims Verification (auth-middleware.ts)
  // --------------------------------------------------------------------------
  console.log("\n3. Verifying VULN-03 (Supabase Auth Middleware & Claims Verification):");

  test("auth-middleware.ts must not grant mock admin based on NODE_ENV !== 'production'", () => {
    const middlewarePath = path.join(
      rootDir,
      "src",
      "integrations",
      "supabase",
      "auth-middleware.ts",
    );
    const content = fs.readFileSync(middlewarePath, "utf8");

    assert.ok(
      !content.includes("process.env['NODE_ENV'] !== \"production\""),
      "VULN-03 VIOLATION: Found environment check automatically granting admin credentials!",
    );
    assert.ok(
      !content.includes("usr-mock-admin-01"),
      "VULN-03 VIOLATION: Found 'usr-mock-admin-01' assigned in claims failure branch!",
    );
    assert.ok(
      content.includes("Unauthorized: Invalid or expired token"),
      "auth-middleware must throw 'Unauthorized: Invalid or expired token' on claims failure",
    );
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Database RLS & Tenant Isolation
  // --------------------------------------------------------------------------
  console.log("\n4. Verifying Database RLS Policies & Tenant Isolation:");

  test("All 27 database tables must have ROW LEVEL SECURITY enabled", () => {
    const sqlPath = path.join(rootDir, "supabase", "setup_new_database.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    const tables = [
      "profiles",
      "user_roles",
      "role_permissions",
      "erp_connections",
      "erp_provider_config",
      "erp_oauth_states",
      "erp_vendors",
      "erp_invoices",
      "erp_payments",
      "erp_contracts",
      "erp_transactions",
      "erp_sync_logs",
      "erp_leaks",
      "erp_leak_activity",
      "erp_recovery_cases",
      "business_profiles",
      "customers",
      "suppliers",
      "product_categories",
      "products",
      "stock_adjustments",
      "sales_invoices",
      "sales_invoice_items",
      "purchase_bills",
      "purchase_bill_items",
      "payments",
      "expenses",
    ];

    for (const table of tables) {
      const rlsRegex = new RegExp(
        `ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        "i",
      );
      assert.ok(
        rlsRegex.test(sql),
        `RLS VIOLATION: Table public.${table} does not enable ROW LEVEL SECURITY!`,
      );
    }
  });

  test("Sensitive ERP credentials tables must have USING (false) server-only policy", () => {
    const sqlPath = path.join(rootDir, "supabase", "setup_new_database.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    assert.ok(
      sql.includes(
        'CREATE POLICY "server only provider config" ON public.erp_provider_config FOR ALL TO authenticated USING (false) WITH CHECK (false);',
      ),
      "erp_provider_config must strictly reject direct client queries via USING (false)",
    );
    assert.ok(
      sql.includes(
        'CREATE POLICY "server only oauth state" ON public.erp_oauth_states FOR ALL TO authenticated USING (false) WITH CHECK (false);',
      ),
      "erp_oauth_states must strictly reject direct client queries via USING (false)",
    );
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Account Deletion & Cascading Eradication
  // --------------------------------------------------------------------------
  console.log("\n5. Verifying Account Deletion & Cascading Purge Constraints:");

  test("deleteMyAccount function must exist and call deleteUser with auth verification", () => {
    const accountPath = path.join(rootDir, "src", "lib", "account.functions.ts");
    const content = fs.readFileSync(accountPath, "utf8");

    assert.ok(
      content.includes("export const deleteMyAccount = createServerFn"),
      "deleteMyAccount server function must be exported",
    );
    assert.ok(
      content.includes(".middleware([requireSupabaseAuth])"),
      "deleteMyAccount must be protected by requireSupabaseAuth middleware",
    );
    assert.ok(
      content.includes("supabaseAdmin.auth.admin.deleteUser(userId)"),
      "deleteMyAccount must invoke admin.deleteUser(userId)",
    );
  });

  test("setup_new_database.sql must configure ON DELETE CASCADE on user-owned foreign keys", () => {
    const sqlPath = path.join(rootDir, "supabase", "setup_new_database.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    const cascadeMatches =
      sql.match(/REFERENCES auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/gi) || [];
    assert.ok(
      cascadeMatches.length >= 15,
      `Expected at least 15 ON DELETE CASCADE foreign keys to auth.users, found ${cascadeMatches.length}`,
    );
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

void runTests();
