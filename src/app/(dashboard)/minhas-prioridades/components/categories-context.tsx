"use client"

import React from "react"
import type { Category } from "./lib"
import { FALLBACK_CAT } from "./lib"

type CatsCtx = {
    categories: Category[]
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>
    catById: (id: string) => Category
}

export const CategoriesContext = React.createContext<CatsCtx>({
    categories: [],
    setCategories: () => {},
    catById: () => FALLBACK_CAT,
})

export function useCats() { return React.useContext(CategoriesContext) }
