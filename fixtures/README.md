# fixtures

Real extracted records per game version, kept small and committed, so every normalizer and every page can be built and tested without the game files. `fixtures/bootstrap/` (spec 00, from the Star Citizen Wiki API with its credit line) is a placeholder until spec 01 captures `fixtures/<version>/` from real extraction. `fixtures/fankit/` is git-ignored. Unit tests read from here and never from the network.
