"use server";

import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getDbUserId } from "./user.action";

export type Profile = Awaited<ReturnType<typeof getProfileByUsername>>;

export type Posts = Awaited<ReturnType<typeof getUserPosts>>;

export const getProfileByUsername = async (username: string) => {
  if (!username) throw new Error("Username not provided");

  try {
    const profile = await prisma.user.findUnique({
      where: {
        username,
      },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        image: true,
        location: true,
        website: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    return profile;
  } catch (error) {
    console.log("Error fetching profile : ", error);
    throw new Error("Failed to fetch user profile");
  }
};

export const getUserPosts = async (userId: string) => {
  if (!userId) throw new Error("User Id required");

  try {
    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return posts;
  } catch (error) {
    console.log("Error fetching user posts : ", error);
    throw new Error("Error fetching posts");
  }
};

export const getUserLikedPosts = async (userId: string) => {
  if (!userId) throw new Error("User Id required");

  try {
    const posts = await prisma.post.findMany({
      where: {
        likes: {
          some: { userId },
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return posts;
  } catch (error) {
    console.log("Error fetching user posts : ", error);
    throw new Error("Error fetching posts");
  }
};

export const updateUserProfile = async (formData: FormData) => {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) throw new Error("Unauthenticated access not allowed");

    const name = formData.get("name") as string;
    const bio = formData.get("bio") as string;
    const location = formData.get("location") as string;
    const website = formData.get("website") as string;

    const user = await prisma.user.update({
      where: {
        clerkId,
      },
      data: {
        name,
        bio,
        location,
        website,
      },
    });

    revalidatePath("/");
    return { success: true, user };
  } catch (error) {
    console.log("Error checking following status: ", error);
    return { success: false };
  }
};

export const isFollowing = async (userId: string) => {
  try {
    const currentUserId = await getDbUserId();
    if (!currentUserId) return false;

    const follow = await prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: userId,
        },
      },
    });

    return !!follow; // converts object to boolean, if value exists, !value is false, and !!value is true, i.e , value converted to true, as it
  } catch (error) {
    console.log("Error checking following status: ", error);
    return false;
  }
};
