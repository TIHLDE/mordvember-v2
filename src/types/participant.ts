export interface Participant {
  player: number;
  name: string;
  study: string;
  class: string;
  hairColor: string;
  eyeColor: string;
  height: string;
  imageUrl: string;
  status: "alive" | "dead";
}
