import { loadEnvConfig } from "@next/env";
import type { PoolConnection } from "mysql2/promise";

const INCREMENTAL_SUFFIX_LIMIT = 10;
const RANDOM_SUFFIX_ATTEMPTS = 5;
const NON_LATIN_SLUG_REGEX = "[^a-z0-9-]";

interface PostRow {
  id: number;
  slug: string;
  title: string | null;
}

interface MigrationPlan {
  id: number;
  title: string | null;
  oldSlug: string;
  newSlug: string;
}

const resolveUniqueSlug = (
  baseSlug: string,
  takenSlugs: Set<string>,
  randomSuffix: () => string,
): string => {
  const normalizedBase = baseSlug || `post-${randomSuffix()}`;

  if (!takenSlugs.has(normalizedBase)) {
    return normalizedBase;
  }

  for (let increment = 2; increment <= INCREMENTAL_SUFFIX_LIMIT + 1; increment += 1) {
    const candidate = `${normalizedBase}-${increment}`;

    if (!takenSlugs.has(candidate)) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < RANDOM_SUFFIX_ATTEMPTS; attempt += 1) {
    const candidate = `${normalizedBase}-${randomSuffix()}`;

    if (!takenSlugs.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to generate unique slug for base: ${normalizedBase}`);
};

const parseArgs = () => process.argv.includes("--dry-run");

async function migrateSlugs() {
  const isDryRun = parseArgs();

  loadEnvConfig(process.cwd());

  const [{ getPool, query }, { generateSlug, randomSlugId }] = await Promise.all([
    import("../lib/db"),
    import("../lib/slug"),
  ]);

  const pool = getPool();

  try {
    const postsToMigrate = await query<PostRow[]>(
      `SELECT id, slug, title FROM posts WHERE slug REGEXP BINARY '${NON_LATIN_SLUG_REGEX}' ORDER BY id ASC`,
    );

    if (!postsToMigrate.length) {
      console.log("No posts found with non-normalized slugs.");
      return;
    }

    const existingSlugRows = await query<Array<{ slug: string }>>("SELECT slug FROM posts");
    const takenSlugs = new Set(existingSlugRows.map(({ slug }) => slug));

    const migrations: MigrationPlan[] = [];

    for (const post of postsToMigrate) {
      takenSlugs.delete(post.slug);

      const title = (post.title ?? "").trim();
      const sourceValue = title || post.slug;
      let baseSlug = generateSlug(sourceValue);

      if (!baseSlug) {
        baseSlug = `post-${randomSlugId()}`;
      }

      const uniqueSlug = resolveUniqueSlug(baseSlug, takenSlugs, randomSlugId);

      if (uniqueSlug === post.slug) {
        takenSlugs.add(post.slug);
        continue;
      }

      takenSlugs.add(uniqueSlug);

      migrations.push({
        id: post.id,
        title: post.title,
        oldSlug: post.slug,
        newSlug: uniqueSlug,
      });
    }

    if (!migrations.length) {
      console.log("No slug updates were necessary.");
      return;
    }

    console.log(`${isDryRun ? "[Dry Run] " : ""}Planned slug updates (${migrations.length}):`);
    for (const migration of migrations) {
      console.log(`- ${migration.oldSlug} -> ${migration.newSlug}`);
    }

    const mapping = migrations.reduce<Record<string, string>>((acc, migration) => {
      acc[migration.oldSlug] = migration.newSlug;
      return acc;
    }, {});

    console.log("Slug mapping:");
    console.log(JSON.stringify(mapping, null, 2));

    if (isDryRun) {
      console.log("Dry run complete. No database changes were made.");
      return;
    }

    let connection: PoolConnection | null = null;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      for (const migration of migrations) {
        await connection.query("UPDATE posts SET slug = ?, updated_at = NOW() WHERE id = ?", [
          migration.newSlug,
          migration.id,
        ]);
      }

      await connection.commit();
      console.log(`Slug migration complete. Updated ${migrations.length} posts.`);
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error("Failed to rollback slug migration transaction:", rollbackError);
        }
      }

      throw error;
    } finally {
      if (connection) {
        connection.release();
        connection = null;
      }
    }
  } finally {
    await pool.end();
  }
}

migrateSlugs().catch((error) => {
  console.error("Slug migration failed:", error);
  process.exit(1);
});
