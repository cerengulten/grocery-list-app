"use client"; // Required for hooks

import { useEffect } from "react";
import { db } from "../src/firebase";
import { collection, addDoc } from "firebase/firestore";

export default function Home() {
  useEffect(() => {
    const testFirestore = async () => {
      try {
        const docRef = await addDoc(collection(db, "testCollection"), {
          message: "Hello from Next.js!"
        });
        console.log("Document written with ID: ", docRef.id);
      } catch (e) {
        console.error("Error adding document: ", e);
      }
    };

    testFirestore();
  }, []);

  return (
    <div className="flex justify-center items-center h-screen">
      <h1 className="text-2xl font-bold">Grocery List App</h1>
    </div>
  );
}
