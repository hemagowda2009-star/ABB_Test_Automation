@thingsboard @api
Feature: ThingsBoard device telemetry REST API
  As an IoT integrator
  I want to query device telemetry through the ThingsBoard REST API
  So that I can verify streamed data is present, valid and fresh

  Background:
    Given the ThingsBoard API client is authenticated with valid credentials

  @auth
  Scenario: Login returns a valid JWT access token and refresh token
    Then the login response should contain a valid JWT for the configured user

  @auth @negative
  Scenario: Telemetry request with an invalid token is rejected
    When the telemetry device is looked up by name
    And latest telemetry is requested with an invalid token
    Then the API response status should be 401

  @device
  Scenario: Telemetry device is found by name
    When the telemetry device is looked up by name
    Then the API response status should be 200
    And the device response should identify a DEVICE entity with the configured name

  @device
  Scenario: Device exposes all expected telemetry keys
    When the telemetry device is looked up by name
    And the device time-series keys are requested
    Then the API response status should be 200
    And the device should expose all configured telemetry keys

  @telemetry
  Scenario: Latest telemetry contains valid key fields
    When the telemetry device is looked up by name
    And latest telemetry is polled until all configured keys are streamed
    Then each telemetry key should contain exactly one latest data point
    And each telemetry data point should have a numeric timestamp within the freshness window
    And each telemetry data point should have a numeric value within its expected range

  @telemetry @realtime
  Scenario: Telemetry continues to stream new data points
    When the telemetry device is looked up by name
    And latest telemetry is polled until all configured keys are streamed
    Then a newer data point for the real-time key should arrive within the polling window

  @telemetry @history
  Scenario: Historical telemetry returns ordered numeric data points
    When the telemetry device is looked up by name
    And telemetry history for the configured window is requested
    Then the API response status should be 200
    And each history series should be ordered newest first with numeric values within range
