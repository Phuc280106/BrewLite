// @ts-ignore - Module "prisma/config" only exists in newer Prisma ORM versions.
import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
  skills: {
    agents: ["claude", "cursor", "agents", "devin"],
  },
});
