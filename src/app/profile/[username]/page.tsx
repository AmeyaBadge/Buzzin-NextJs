import {
  getProfileByUsername,
  getUserLikedPosts,
  getUserPosts,
  isFollowing,
} from "@/actions/profile.action";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import ProfilePageClient from "./ProfilePageClient";

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> => {
  const { username } = await params;
  const user = await getProfileByUsername(username);

  if (!user)
    return {
      title: "Profile Not Found",
      description: "Profile Not Found",
    };

  return {
    title: `${user.name ?? user.username}`,
    description: user.bio || `Check our ${user.username}'s profile.`,
  };
};

const ProfilePageServer = async ({
  params,
}: {
  params: Promise<{ username: string }>;
}) => {
  const { username } = await params;
  const user = await getProfileByUsername(username);

  if (!user) notFound();

  const [posts, likedPosts, isCurrentUserFollowing] = await Promise.all([
    getUserPosts(user.id),
    getUserLikedPosts(user.id),
    isFollowing(user.id),
  ]);

  return (
    <ProfilePageClient
      user={user}
      posts={posts}
      likedPosts={likedPosts}
      isFollowing={isCurrentUserFollowing}
    />
  );
};

export default ProfilePageServer;
