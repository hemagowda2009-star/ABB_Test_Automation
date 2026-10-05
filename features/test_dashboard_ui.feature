@thingsboard @dashboardui
Feature: ThingsBoard Device Telemetry Dashboard monitoring
  As an IoT operator
  I want the Device Telemetry Dashboard to show live, valid telemetry
  So that I can monitor simulated devices in real time

  Background:
    Given the user opens the ThingsBoard login page
    When the user logs in to ThingsBoard with valid credentials
    And the user navigates to the configured telemetry dashboard

  @smoke
  Scenario: Dashboard loads with all telemetry widgets
    Then the telemetry dashboard should be displayed
    And all configured telemetry widgets should be visible
    And a dashboard screenshot named "dashboard_loaded" is captured

  @datavalidation
  Scenario: Latest telemetry values are numeric and within expected ranges
    Then each telemetry widget should show a numeric value within its expected range
    And a dashboard screenshot named "telemetry_values" is captured

  @realtime
  Scenario Outline: <widget> telemetry updates in real time
    Then the "<widget>" widget value should update in real time
    And a dashboard screenshot named "<widget>_realtime" is captured

    Examples:
      | widget      |
      | Temperature |
      | Humidity    |

  @chart
  Scenario: Time-series chart renders streamed telemetry
    Then the time-series chart widget should be rendered
    And a dashboard screenshot named "telemetry_chart" is captured