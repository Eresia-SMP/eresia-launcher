import { Updater, writable } from "svelte/store";

export type MojangLoginData = Readonly<{
    email: string;
    accessToken: string;
    profile: {
        name: string;
        uuid: string;
    };
}>;

let loginData: undefined | MojangLoginData = undefined;
let storedLoginData = localStorage.getItem("mojangLoginData");
if (storedLoginData !== null) loginData = JSON.parse(storedLoginData);

function saveData(data: typeof loginData) {
    if (data === undefined) localStorage.removeItem("mojangLoginData");
    else localStorage.setItem("mojangLoginData", JSON.stringify(data));
}

const { subscribe, set, update } = writable(loginData);

export default {
    subscribe,
    set: (v: undefined | MojangLoginData) => {
        saveData(v);
        set(v);
    },
    update: (u: Updater<undefined | MojangLoginData>) => {
        update(v => {
            let newValue = u(v);
            saveData(newValue);
            return newValue;
        });
    },
};
