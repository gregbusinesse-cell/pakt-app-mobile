import type { Profile, Match, Like, Conversation, Message } from './types';

export const mockProfiles: Profile[] = [
  {
    id: 'user2',
    first_name: 'Sarah',
    age: 24,
    bio: 'Passionnée par le yoga et les voyages. J\'aime découvrir de nouveaux endroits et rencontrer des gens intéressants.',
    city: 'Paris',
    photos: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
    ],
    skills: [
      { skill: 'Design', level: 8 },
      { skill: 'Photography', level: 7 },
    ],
    interests: ['Voyage', 'Yoga', 'Photographie'],
    plan: 'free',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user3',
    first_name: 'Emma',
    age: 26,
    bio: 'Développeuse web qui aime coder et sortir en nature. Toujours prête pour une randonnée!',
    city: 'Lyon',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
    ],
    skills: [
      { skill: 'Development', level: 9 },
      { skill: 'Design', level: 6 },
    ],
    interests: ['Coding', 'Nature', 'Musique'],
    plan: 'business',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user4',
    first_name: 'Julie',
    age: 22,
    bio: 'Étudiante en marketing, j\'aime les sorties entre amis et les bons restaurants.',
    city: 'Bordeaux',
    photos: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop',
    ],
    skills: [
      { skill: 'Marketing', level: 7 },
      { skill: 'Social Media', level: 8 },
    ],
    interests: ['Marketing', 'Gastronomie', 'Mode'],
    plan: 'free',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user5',
    first_name: 'Léa',
    age: 25,
    bio: 'Graphiste créative avec passion pour l\'art et le design. Toujours à la recherche d\'inspiration!',
    city: 'Marseille',
    photos: [
      'https://images.unsplash.com/photo-1502185881662-2d440ac1c159?w=400&h=500&fit=crop',
    ],
    skills: [
      { skill: 'Design', level: 9 },
      { skill: 'Illustration', level: 8 },
    ],
    interests: ['Art', 'Design', 'Musique'],
    plan: 'business_pro',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const mockMatches: Match[] = [
  {
    id: 'match1',
    profile_id: 'user2',
    matched_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    is_viewed: false,
  },
  {
    id: 'match2',
    profile_id: 'user3',
    matched_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    is_viewed: true,
  },
];

export const mockLikes: Like[] = [
  {
    id: 'like1',
    profile_id: 'user4',
    liked_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    is_viewed: false,
  },
  {
    id: 'like2',
    profile_id: 'user5',
    liked_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    is_viewed: false,
  },
];

export const mockConversations: Conversation[] = [
  {
    id: 'conv1',
    user_id_1: 'current_user',
    user_id_2: 'user2',
    last_message: 'Salut! Ça va? 😊',
    last_message_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'conv2',
    user_id_1: 'current_user',
    user_id_2: 'user3',
    last_message: 'On se voit ce weekend?',
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];

export const mockMessages: Message[] = [
  {
    id: 'msg1',
    conversation_id: 'conv1',
    sender_id: 'user2',
    content: 'Salut! Comment ça va?',
    message_type: 'text',
    file_url: null,
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    conversation_type: 'match',
  },
  {
    id: 'msg2',
    conversation_id: 'conv1',
    sender_id: 'current_user',
    content: 'Très bien! Et toi?',
    message_type: 'text',
    file_url: null,
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    conversation_type: 'match',
  },
  {
    id: 'msg3',
    conversation_id: 'conv1',
    sender_id: 'user2',
    content: 'Super! Je suis content de te parler 😊',
    message_type: 'text',
    file_url: null,
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    conversation_type: 'match',
  },
];

export const mockCurrentUser: Profile = {
  id: 'current_user',
  first_name: 'Alex',
  age: 27,
  bio: 'Entrepreneur passionné par la tech et les rencontres intéressantes.',
  city: 'Paris',
  photos: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
  ],
  skills: [
    { skill: 'Development', level: 8 },
    { skill: 'Leadership', level: 7 },
  ],
  interests: ['Tech', 'Startup', 'Voyage'],
  plan: 'business',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
