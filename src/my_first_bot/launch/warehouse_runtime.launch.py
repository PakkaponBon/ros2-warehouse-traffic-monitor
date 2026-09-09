"""Launch the reusable simulation, localization, and traffic-monitoring stack."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    IncludeLaunchDescription,
    SetEnvironmentVariable,
    TimerAction,
)
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    package_share = Path(get_package_share_directory("my_first_bot"))
    gazebo_share = Path(get_package_share_directory("gazebo_ros"))

    world = LaunchConfiguration("world")
    map_yaml = LaunchConfiguration("map")
    map_image = LaunchConfiguration("map_image")
    database = LaunchConfiguration("database")
    stuck_duration = LaunchConfiguration("stuck_duration")
    slow_speed = LaunchConfiguration("slow_speed")
    congestion_radius = LaunchConfiguration("congestion_radius")
    congestion_min_vehicles = LaunchConfiguration("congestion_min_vehicles")
    congestion_duration = LaunchConfiguration("congestion_duration")
    vehicle_count = LaunchConfiguration("vehicle_count")
    traffic_speed = LaunchConfiguration("traffic_speed")
    traffic_seed = LaunchConfiguration("traffic_seed")
    traffic_profile = LaunchConfiguration("traffic_profile")
    traffic_pose_source = LaunchConfiguration("traffic_pose_source")
    localization_drive_interlock = LaunchConfiguration(
        "localization_drive_interlock"
    )
    world_to_map_x = LaunchConfiguration("world_to_map_x")
    world_to_map_y = LaunchConfiguration("world_to_map_y")
    world_to_map_yaw = LaunchConfiguration("world_to_map_yaw")
    web_port = LaunchConfiguration("web_port")
    web_host = LaunchConfiguration("web_host")
    web_root = LaunchConfiguration("web_root")
    uwb_tag_config = LaunchConfiguration("uwb_tag_config")
    uwb_range_noise = LaunchConfiguration("uwb_range_noise")
    uwb_dropout_rate = LaunchConfiguration("uwb_dropout_rate")
    uwb_maximum_range = LaunchConfiguration("uwb_maximum_range")
    uwb_confirm_threshold = LaunchConfiguration("uwb_confirm_threshold")
    uwb_warning_threshold = LaunchConfiguration("uwb_warning_threshold")
    uwb_max_pair_skew = LaunchConfiguration("uwb_max_pair_skew")
    uwb_validation_hysteresis = LaunchConfiguration("uwb_validation_hysteresis")
    uwb_problem_samples = LaunchConfiguration("uwb_problem_samples")
    uwb_recovery_samples = LaunchConfiguration("uwb_recovery_samples")
    use_web = LaunchConfiguration("use_web")
    use_rviz = LaunchConfiguration("use_rviz")
    gui = LaunchConfiguration("gui")
    spawn_robot = LaunchConfiguration("spawn_robot")

    urdf_path = package_share / "urdf" / "my_bot.urdf"
    robot_description = urdf_path.read_text(encoding="utf-8")

    return LaunchDescription(
        [
            DeclareLaunchArgument(
                "world", default_value=str(package_share / "worlds" / "warehouse_2d.world")
            ),
            DeclareLaunchArgument(
                "map", default_value=str(package_share / "maps" / "warehouse.yaml")
            ),
            DeclareLaunchArgument(
                "map_image", default_value=str(package_share / "maps" / "warehouse.png")
            ),
            DeclareLaunchArgument(
                "database",
                default_value=str(Path.home() / ".ros" / "warehouse_traffic.db"),
            ),
            DeclareLaunchArgument("use_rviz", default_value="false"),
            DeclareLaunchArgument("gui", default_value="true"),
            DeclareLaunchArgument("spawn_robot", default_value="true"),
            DeclareLaunchArgument("stuck_duration", default_value="60.0"),
            DeclareLaunchArgument("slow_speed", default_value="0.05"),
            DeclareLaunchArgument("congestion_radius", default_value="2.0"),
            DeclareLaunchArgument("congestion_min_vehicles", default_value="3"),
            DeclareLaunchArgument("congestion_duration", default_value="15.0"),
            DeclareLaunchArgument("vehicle_count", default_value="8"),
            DeclareLaunchArgument("traffic_speed", default_value="0.8"),
            DeclareLaunchArgument("traffic_seed", default_value="42"),
            DeclareLaunchArgument("traffic_profile", default_value="warehouse_2d"),
            DeclareLaunchArgument("traffic_pose_source", default_value="gazebo"),
            DeclareLaunchArgument(
                "localization_drive_interlock",
                default_value="false",
                description=(
                    "Require fresh AMCL recovery readiness before simulated motion"
                ),
            ),
            DeclareLaunchArgument("world_to_map_x", default_value="0.0"),
            DeclareLaunchArgument("world_to_map_y", default_value="0.0"),
            DeclareLaunchArgument("world_to_map_yaw", default_value="0.0"),
            DeclareLaunchArgument("web_port", default_value="8080"),
            DeclareLaunchArgument("web_host", default_value="127.0.0.1"),
            DeclareLaunchArgument(
                "web_root", default_value=str(package_share / "web" / "dist")
            ),
            DeclareLaunchArgument(
                "uwb_tag_config",
                default_value=str(package_share / "config" / "uwb_tags.yaml"),
            ),
            DeclareLaunchArgument("uwb_range_noise", default_value="0.10"),
            DeclareLaunchArgument("uwb_dropout_rate", default_value="0.05"),
            DeclareLaunchArgument("uwb_maximum_range", default_value="45.0"),
            DeclareLaunchArgument("uwb_confirm_threshold", default_value="0.5"),
            DeclareLaunchArgument("uwb_warning_threshold", default_value="1.0"),
            DeclareLaunchArgument("uwb_max_pair_skew", default_value="0.35"),
            DeclareLaunchArgument("uwb_validation_hysteresis", default_value="0.10"),
            DeclareLaunchArgument("uwb_problem_samples", default_value="3"),
            DeclareLaunchArgument("uwb_recovery_samples", default_value="3"),
            DeclareLaunchArgument("use_web", default_value="true"),
            # Keep Gazebo's system resources while also exposing this package's
            # bundled warehouse meshes referenced by newwarehouse.world.
            SetEnvironmentVariable(
                "GAZEBO_RESOURCE_PATH",
                f"{package_share}:/usr/share/gazebo-11",
            ),
            SetEnvironmentVariable(
                "GAZEBO_MODEL_PATH",
                f"{package_share / 'models'}:/usr/share/gazebo-11/models",
            ),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(
                    str(gazebo_share / "launch" / "gazebo.launch.py")
                ),
                launch_arguments={"world": world, "gui": gui, "verbose": "false"}.items(),
            ),
            Node(
                package="robot_state_publisher",
                executable="robot_state_publisher",
                parameters=[{"robot_description": robot_description, "use_sim_time": True}],
                output="screen",
            ),
            TimerAction(
                period=2.0,
                actions=[
                    Node(
                        package="gazebo_ros",
                        executable="spawn_entity.py",
                        arguments=[
                            "-entity",
                            "my_robot",
                            "-file",
                            str(urdf_path),
                            "-x",
                            "0.0",
                            "-y",
                            "0.0",
                            "-z",
                            "0.11",
                        ],
                        output="screen",
                        condition=IfCondition(spawn_robot),
                    )
                ],
            ),
            Node(
                package="nav2_map_server",
                executable="map_server",
                name="map_server",
                parameters=[{"yaml_filename": map_yaml, "use_sim_time": True}],
                output="screen",
            ),
            Node(
                package="nav2_amcl",
                executable="amcl",
                name="amcl",
                parameters=[
                    str(package_share / "config" / "localization.yaml"),
                    {"use_sim_time": True},
                ],
                output="screen",
            ),
            Node(
                package="nav2_lifecycle_manager",
                executable="lifecycle_manager",
                name="localization_lifecycle_manager",
                parameters=[
                    {
                        "use_sim_time": True,
                        "autostart": True,
                        "node_names": ["map_server", "amcl"],
                    }
                ],
                output="screen",
            ),
            Node(
                package="my_first_bot",
                executable="traffic_recorder.py",
                name="traffic_recorder",
                parameters=[
                    {
                        "database_path": database,
                        "use_sim_time": True,
                        "stuck_duration": stuck_duration,
                        "slow_speed": slow_speed,
                        "congestion_radius": congestion_radius,
                        "congestion_min_vehicles": congestion_min_vehicles,
                        "congestion_duration": congestion_duration,
                        "traffic_vehicle_count": vehicle_count,
                        "traffic_pose_source": traffic_pose_source,
                        "model_states_frame": "world",
                        "world_to_map_x": world_to_map_x,
                        "world_to_map_y": world_to_map_y,
                        "world_to_map_yaw": world_to_map_yaw,
                    }
                ],
                output="screen",
            ),
            Node(
                package="my_first_bot",
                executable="traffic_simulator.py",
                name="traffic_simulator",
                parameters=[
                    {
                        "use_sim_time": True,
                        "vehicle_count": vehicle_count,
                        "max_speed": traffic_speed,
                        "seed": traffic_seed,
                        "profile": traffic_profile,
                        "pose_source": traffic_pose_source,
                        "require_localization_ready": localization_drive_interlock,
                        "map_yaml": map_yaml,
                    }
                ],
                output="screen",
            ),
            Node(
                package="my_first_bot",
                executable="uwb_simulator.py",
                name="uwb_simulator",
                parameters=[
                    {
                        "use_sim_time": True,
                        "vehicle_count": vehicle_count,
                        "include_main_vehicle": True,
                        "world_to_map_x": world_to_map_x,
                        "world_to_map_y": world_to_map_y,
                        "world_to_map_yaw": world_to_map_yaw,
                        "seed": traffic_seed,
                        "tag_config": uwb_tag_config,
                        "range_noise": uwb_range_noise,
                        "tag_dropout_rate": uwb_dropout_rate,
                        "maximum_range": uwb_maximum_range,
                    }
                ],
                output="screen",
            ),
            Node(
                package="my_first_bot",
                executable="localization_validator.py",
                name="localization_validator",
                parameters=[
                    {
                        "use_sim_time": True,
                        "vehicle_count": vehicle_count,
                        "include_main_vehicle": True,
                        "confirm_threshold": uwb_confirm_threshold,
                        "warning_threshold": uwb_warning_threshold,
                        "max_pair_skew": uwb_max_pair_skew,
                        "hysteresis": uwb_validation_hysteresis,
                        "problem_samples": uwb_problem_samples,
                        "recovery_samples": uwb_recovery_samples,
                    }
                ],
                output="screen",
            ),
            Node(
                package="my_first_bot",
                executable="traffic_heatmap.py",
                name="traffic_heatmap",
                parameters=[{"database_path": database, "use_sim_time": True}],
                output="screen",
            ),
            Node(
                package="my_first_bot",
                executable="web_monitor.py",
                name="web_monitor",
                parameters=[
                    {
                        "database_path": database,
                        "web_host": web_host,
                        "web_port": web_port,
                        "web_root": web_root,
                        "slow_speed": slow_speed,
                        "map_yaml": map_yaml,
                        "map_image": map_image,
                        "uwb_tag_config": uwb_tag_config,
                        "traffic_vehicle_count": vehicle_count,
                    }
                ],
                condition=IfCondition(use_web),
                output="screen",
            ),
            Node(
                package="rviz2",
                executable="rviz2",
                arguments=["-d", str(package_share / "rviz" / "warehouse_traffic.rviz")],
                parameters=[{"use_sim_time": True}],
                condition=IfCondition(use_rviz),
                output="screen",
            ),
        ]
    )
