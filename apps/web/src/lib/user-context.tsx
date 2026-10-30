'use client';
import { createContext, useContext } from 'react';
import { User } from './types';

export const UserCtx = createContext<User | null>(null);
export const useUser = () => useContext(UserCtx) as User;
