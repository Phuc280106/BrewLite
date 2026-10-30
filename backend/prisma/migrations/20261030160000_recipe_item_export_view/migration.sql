CREATE VIEW "RecipeItemExport" AS
SELECT
    p."id" AS "productId",
    p."name" AS "product",
    ri."size",
    string_agg(
        concat(i."name", ': ', ri."amount"::text, ' ', i."unit"),
        ' | '
        ORDER BY i."name"
    ) AS "ingredients"
FROM "RecipeItem" ri
JOIN "Product" p ON p."id" = ri."productId"
JOIN "Ingredient" i ON i."id" = ri."ingredientId"
GROUP BY p."id", p."name", ri."size";
