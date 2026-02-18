import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export const testFirestore = async () => {
  try {
    const docRef = await addDoc(collection(db, "testCollection"), {
      message: "Hello from Next.js!"
    });
    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
};
