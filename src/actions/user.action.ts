"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

//To create a new user record {if doesnt exist} for the current clerk authed user
export const syncUser = async () => {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) return;

    //check if user already exists.
    const existingUser = await prisma.user.findUnique({
      where: {
        clerkId: userId,
      },
    });

    if (existingUser) return existingUser;

    const dbUser = await prisma.user.create({
      data: {
        clerkId: userId,
        name: `${user.firstName || ""} ${user.lastName || ""}`,
        username:
          user.username ?? user.emailAddresses[0].emailAddress.split("@")[0],
        email: user.emailAddresses[0].emailAddress,
        image: user.imageUrl,
      },
    });

    return dbUser;
  } catch (error) {
    console.log("Error in SyncUser : ", error);
  }
};

//Get the user from DB using the clerk id of currently logged in user
export const getUserByClerkId = async (clerkId: string) => {
  const user = prisma.user.findUnique({
    where: {
      clerkId,
    },
    include: {
      _count: {
        select: {
          followers: true,
          following: true,
          posts: true,
        },
      },
    },
  });

  return user;
};

//Get the posgres document Id from ClerkId
export const getDbUserId = async () => {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorised access not allowed!");

  const user = await prisma.user.findUnique({
    where: {
      clerkId,
    },
    select: {
      id: true,
    },
  });

  if (!user) throw new Error("User not found!");

  return user.id;
};

//Get random users for suggested users to follow
export const getRandomUsers = async () => {
  try {
    // Get 3 random users, exluding self and the ones we already follow
    const userId = await getDbUserId();

    const randomUsers = await prisma.user.findMany({
      where: {
        AND: [
          {
            NOT: { id: userId },
          },
          { NOT: { followers: { some: { followerId: userId } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        _count: {
          select: {
            followers: true,
          },
        },
      },
      take: 3,
    });

    return randomUsers;
  } catch (error) {
    console.log("Error fetching suggested random users: ", error);
    return [];
  }
};

//Follow toggle action
export const toggleFollow = async (targetUserId: string) => {
  try {
    const userId = await getDbUserId();
    if (targetUserId === userId) throw new Error("You cannot follow yourself!");
    const existingFollow = await prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      //Unfollow
      await prisma.follows.delete({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: targetUserId,
          },
        },
      });
    } else {
      //Follow Transaction {Because need to create the follow record and the notification } [either all or nothing]
      await prisma.$transaction([
        prisma.follows.create({
          data: {
            followerId: userId,
            followingId: targetUserId,
          },
        }),
        // Creating the notification for follow
        prisma.notification.create({
          data: {
            type: "FOLLOW",
            userId: targetUserId, //user who is being followed
            creatorId: userId, // Person who started following
          },
        }),
      ]);
    }

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.log("Error in follow action : ", error);
    return { success: false, error: "Error toggling follow" };
  }
};
