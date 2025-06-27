"use server";

import { auth } from "@clerk/nextjs/server";
import { getDbUserId } from "./user.action";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const createPost = async (content: string, imageUrl: string) => {
  try {
    const userId = await getDbUserId();

    const post = await prisma.post.create({
      data: {
        content,
        image: imageUrl,
        authorId: userId,
      },
    });

    revalidatePath("/"); // To purge the content of the Homepage and fetch the post
    return { success: true, post };
  } catch (error) {
    console.log("Failed to create post : ", error);
    return { success: false, error: "Failed to create Post" };
  }
};
