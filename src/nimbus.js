import { elements as weatherElements } from "../utils/elements.js";
import "https://deno.land/std@0.204.0/dotenv/load.ts";

const stringifyDetails = () => {
  return new TransformStream({
    transform(chunk, controller) {
      const { element, ...rest } = chunk;
      const summary = Object.entries(rest).map(([heading, detail]) => {
        return `${heading}: ${detail}`;
      });
      const weatherDetails = new TextEncoder().encode(
        element.join("\n") + "\n" + summary.join("\n")
      );
      controller.enqueue(weatherDetails);
    },
  });
};

const attachWeatherElement = () => {
  return new TransformStream({
    transform(chunk, controller) {
      const elements = weatherElements();
      const currentWeather = chunk.main;
      if (!(currentWeather in elements)) {
        controller.enqueue({ element: elements.default, ...chunk });
        return;
      }
      controller.enqueue({ element: elements[currentWeather], ...chunk });
    },
  });
};

const extractWeatherDetails = ({ main, description }) => {
  return {
    main,
    description,
  };
};

const extractOtherDetails = ({ temp, temp_min, temp_max }) => {
  return {
    temperature: temp,
    min_temp: temp_min,
    max_temp: temp_max,
  };
};

const organiseData = () => {
  return new TransformStream({
    transform(chunk, controller) {
      const weatherDetails = extractWeatherDetails(chunk.weather[0]);
      const otherDetails = extractOtherDetails(chunk.main);
      controller.enqueue({
        ...weatherDetails,
        ...otherDetails,
        cityName: chunk.cityName,
      });
    },
  });
};

const extractDetails = () => {
  return new TransformStream({
    transform(chunk, controller) {
      const {
        weather,
        main,
        name: cityName,
      } = JSON.parse(new TextDecoder().decode(chunk));
      controller.enqueue({ weather, main, cityName });
    },
  });
};

const main = async (args) => {
  const API_KEY = Deno.env.get("API_KEY");
  const [city] = args;
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${city}&APPID=${API_KEY}`
  );

  await response.body
    .pipeThrough(extractDetails())
    .pipeThrough(organiseData())
    .pipeThrough(attachWeatherElement())
    .pipeThrough(stringifyDetails())
    .pipeTo(Deno.stdout.writable);
};

main(Deno.args);
