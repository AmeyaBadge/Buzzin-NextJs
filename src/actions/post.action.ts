"use server";

import { auth } from "@clerk/nextjs/server";
import { getDbUserId } from "./user.action";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const createPost = async (content: string, imageUrl: string) => {
  try {
    const userId = await getDbUserId();

    if (!userId) return;

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

export const getPosts = async () => {
  try {
    const userId = await getDbUserId();

    const posts = await prisma.post.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        author: {
          select: {
            name: true,
            image: true,
            username: true,
          },
        },
        comments: {
          select: {
            content: true,
            id: true,
            createdAt: true,
            author: {
              select: {
                name: true,
                username: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    return posts;
  } catch (error) {
    console.log("Error in getting Posts : ", error);
    return [];
  }
};

export const toggleLike = async (postId: string) => {
  try {
    const userId = await getDbUserId();
    if (!userId) return;

    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        authorId: true,
      },
    });

    if (!post) throw new Error("Post not found");

    if (existingLike) {
      //Delete a Like record from table
      await prisma.like.delete({
        where: {
          id: existingLike.id,
        },
      });
    } else {
      // Create a like record, and notify user if it is not self

      await prisma.$transaction([
        prisma.like.create({
          data: {
            postId,
            userId,
          },
        }),
        ...(post.authorId !== userId
          ? [
              prisma.notification.create({
                data: {
                  type: "LIKE",
                  creatorId: userId,
                  userId: post.authorId, // Person who will recieve the notification
                  postId: postId,
                },
              }),
            ]
          : []),
      ]);
    }
  } catch (error) {}
};

export const createCommment = async (content: string, postId: string) => {
  try {
    const userId = await getDbUserId();
    if (!userId) return;

    if (!content) throw new Error("Comment is required");

    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        authorId: true,
      },
    });

    if (!post) throw new Error("Post not found");

    const [comment] = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          content,
          authorId: userId,
          postId: postId,
        },
      });

      // create notification if commenting on someone's else post
      if (post.authorId !== userId) {
        await tx.notification.create({
          data: {
            type: "COMMENT",
            userId: post.authorId, // The person recieving the notification
            creatorId: userId,
            postId: postId,
            commentId: newComment.id,
          },
        });
      }

      return [newComment];
    });

    revalidatePath(`/`);
    return { success: true, comment };
  } catch (error) {
    console.error("Failed to create comment:", error);
    return { success: false, error: "Failed to create comment" };
  }
};

export const deletePost = async (postId: string) => {
  try {
    const userId = await getDbUserId();

    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      select: {
        authorId: true,
      },
    });

    if (!post) throw new Error("Post not found!");
    if (post.authorId !== userId)
      throw new Error("Unauthorized - No delete permission");

    await prisma.post.delete({ where: { id: postId } });

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("Failed to Delete Post :", error);
    return { success: false, error: "Failed to delete Post" };
  }
};
