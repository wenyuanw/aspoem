import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { getRandom } from "~/utils/unsplash";

export const cardRouter = createTRPCRouter({
  /**
   * 获取需要生成 Card 的诗词
   */
  getGenerateCard: publicProcedure
    .input(
      z.object({
        token: z.string(),
        page: z.number().default(1),
        tagName: z.string().default("七言律诗"),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.token !== process.env.TOKEN) {
        throw new Error("token error");
      }

      const where = {
        AND: [
          { tags: { some: { name: input.tagName } } },
          {
            cards: { none: {} },
          },
        ],
      };

      const [result, count, urls] = await Promise.all([
        ctx.db.poem.findMany({
          where,
          select: {
            author: true,
            id: true,
            content: true,
            title: true,
          },
          orderBy: {
            id: "asc",
          },
          skip: (input.page - 1) * 30,
          take: 30,
        }),
        ctx.db.poem.count({
          where,
        }),
        getRandom(),
      ]);

      return {
        data: result,
        total: count,
        urls,
        pageCount: Math.ceil(count / 30),
      };
    }),

  createCardItem: publicProcedure
    .input(
      z.object({
        token: z.string(),
        poemId: z.number(),
        content: z.string(),
        url: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.token !== process.env.TOKEN) {
        throw new Error("token error");
      }

      return ctx.db.card.create({
        data: {
          poemId: input.poemId,
          url: input.url,
          content: input.content,
        },
      });
    }),

  find: publicProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(28),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize } = input;

      const [data, total] = await ctx.db.$transaction([
        ctx.db.card.findMany({
          take: pageSize,
          skip: (page - 1) * pageSize,
          orderBy: {
            id: "desc",
          },
        }),
        ctx.db.card.count(),
      ]);

      return {
        data,
        hasNext: page * pageSize < total,
        total,
        page,
        pageSize,
      };
    }),

  random: publicProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.card.count();
    const skip = Math.floor(Math.random() * count);

    return ctx.db.card.findMany({
      take: 30,
      skip: skip,
      orderBy: {
        id: "desc",
      },
    });
  }),

  count: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.card.count();
  }),
});
