cmake_minimum_required(VERSION 3.8)
project(my_first_bot)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# find dependencies
find_package(ament_cmake REQUIRED)
# uncomment the following section in order to fill in
# further dependencies manually.
# find_package(<dependency> REQUIRED)

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  find_package(ament_cmake_pytest REQUIRED)
  # the following line skips the linter which checks for copyrights
  # comment the line when a copyright and license is added to all source files
  set(ament_cmake_copyright_FOUND TRUE)
  # the following line skips cpplint (only works in a git repo)
  # comment the line when this package is in a git repo and when
  # a copyright and license is added to all source files
  set(ament_cmake_cpplint_FOUND TRUE)
  ament_lint_auto_find_test_dependencies()
  ament_add_pytest_test(traffic_common_test test/test_traffic_common.py)
  ament_add_pytest_test(traffic_simulator_test test/test_traffic_simulator.py)
  ament_add_pytest_test(grid_planner_test test/test_grid_planner.py)
  ament_add_pytest_test(real_warehouse_test test/test_real_warehouse.py)
  ament_add_pytest_test(web_monitor_test test/test_web_monitor.py)
endif()

install(DIRECTORY
  launch
  urdf
  worlds
  models
  maps
  config
  rviz
  DESTINATION share/${PROJECT_NAME}
)

install(
  DIRECTORY web/dist
  DESTINATION share/${PROJECT_NAME}/web
)

install(
  PROGRAMS
    scripts/traffic_recorder.py
    scripts/traffic_heatmap.py
    scripts/traffic_simulator.py
    scripts/spawn_localized_vehicle.py
    scripts/uwb_simulator.py
    scripts/uwb_amcl_initializer.py
    scripts/localization_validator.py
    scripts/prepare_slam_map.py
    scripts/web_monitor.py
  DESTINATION lib/${PROJECT_NAME}
)

install(
  FILES scripts/traffic_common.py scripts/grid_planner.py
  DESTINATION lib/${PROJECT_NAME}
)

ament_package()
