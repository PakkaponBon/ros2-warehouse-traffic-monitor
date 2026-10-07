cmake_minimum_required(VERSION 3.8)
project(warehouse_2d)

find_package(ament_cmake REQUIRED)

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  find_package(ament_cmake_pytest REQUIRED)
  set(ament_cmake_copyright_FOUND TRUE)
  set(ament_cmake_cpplint_FOUND TRUE)
  ament_lint_auto_find_test_dependencies()
  ament_add_pytest_test(traffic_common_test test/test_traffic_common.py)
  ament_add_pytest_test(traffic_simulator_test test/test_traffic_simulator.py)
  ament_add_pytest_test(grid_planner_test test/test_grid_planner.py)
  ament_add_pytest_test(web_monitor_test test/test_web_monitor.py)
  ament_add_pytest_test(delivery_tasks_test test/test_delivery_tasks.py)
  ament_add_pytest_test(amcl_recovery_test test/test_amcl_recovery.py)
endif()

install(DIRECTORY launch worlds models maps config rviz
  DESTINATION share/${PROJECT_NAME})
install(DIRECTORY web/dist DESTINATION share/${PROJECT_NAME}/web)

install(PROGRAMS
  scripts/warehouse_gate_control.py
  scripts/warehouse_mapping_driver.py
  scripts/mapping_path.py
  scripts/warehouse_delivery_simulator.py
  scripts/ensure_traffic_amcl.py
  scripts/gazebo_amcl_validator.py
  scripts/traffic_recorder.py
  scripts/traffic_heatmap.py
  scripts/spawn_localized_vehicle.py
  scripts/prepare_slam_map.py
  scripts/web_monitor.py
  DESTINATION lib/${PROJECT_NAME})

install(FILES
  scripts/traffic_common.py
  scripts/grid_planner.py
  scripts/simulation_faults.py
  scripts/delivery_tasks.py
  scripts/traffic_simulator.py
  DESTINATION lib/${PROJECT_NAME})

ament_package()
