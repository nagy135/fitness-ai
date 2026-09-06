{
  description = "AI Fitness Tracker development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          pnpm22 = pkgs.writeShellScriptBin "pnpm" ''
            exec ${pkgs.nodejs_22}/bin/node ${pkgs.pnpm}/libexec/pnpm/bin/pnpm.cjs "$@"
          '';
          darwinTools = pkgs.lib.optionals pkgs.stdenv.hostPlatform.isDarwin [
            pkgs.cocoapods
          ];
        in {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pnpm22
              pkgs.jdk17
              pkgs.watchman
              pkgs.docker-client
              pkgs.git
            ] ++ darwinTools;

            JAVA_HOME = "${pkgs.jdk17}";

            shellHook = ''
              export PNPM_HOME="$PWD/.pnpm-home"
              export PATH="$PNPM_HOME:$PATH"
              export EXPO_NO_TELEMETRY=1

              echo "AI Fitness Tracker dev shell"
              echo "Node $(node --version) | pnpm $(pnpm --version) | Java $(java -version 2>&1 | head -n 1)"
            '';
          };
        });
    };
}
