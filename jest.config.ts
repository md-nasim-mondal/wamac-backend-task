const config = {
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(spec|test).[t]s"],
  moduleDirectories: ["node_modules"],
};

export default config;
